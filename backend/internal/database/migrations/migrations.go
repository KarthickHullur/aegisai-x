package migrations

import (
	"database/sql"
	"fmt"
	"log"
)

// RunMigrations creates the database tables if they do not exist
func RunMigrations(db *sql.DB) error {
	log.Println("[Migrations] Starting database migrations...")

	// 1. Create cloud_copilot_sessions table
	log.Println("[Migrations] Creating cloud_copilot_sessions...")
	queryCopilot := `
	CREATE TABLE IF NOT EXISTS cloud_copilot_sessions (
		id SERIAL PRIMARY KEY,
		question TEXT NOT NULL,
		response TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`
	if _, err := db.Exec(queryCopilot); err != nil {
		log.Printf("[Migrations] ERROR: %v", err)
		log.Fatalf("[Migrations] ERROR: %v", err)
		return fmt.Errorf("migration failed to create cloud_copilot_sessions: %w", err)
	}

	// 2. Create memory_records table
	log.Println("[Migrations] Creating memory_records...")
	// Safely drop memory_records if it contains the legacy schema column 'summary'
	dropOldMemoryRecordsQuery := `
	DO $$
	BEGIN
		IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memory_records' AND column_name = 'summary') THEN
			DROP TABLE memory_records;
		END IF;
	END;
	$$;`
	if _, err := db.Exec(dropOldMemoryRecordsQuery); err != nil {
		log.Printf("[Migrations] ERROR: %v", err)
		log.Fatalf("[Migrations] ERROR: %v", err)
		return fmt.Errorf("migration failed to drop old memory_records table: %w", err)
	}

	queryMemoryRecords := `
	CREATE TABLE IF NOT EXISTS memory_records (
		id SERIAL PRIMARY KEY,
		title TEXT NOT NULL,
		category TEXT NOT NULL,
		content TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`
	if _, err := db.Exec(queryMemoryRecords); err != nil {
		log.Printf("[Migrations] ERROR: %v", err)
		log.Fatalf("[Migrations] ERROR: %v", err)
		return fmt.Errorf("migration failed to create memory_records: %w", err)
	}

	// 3. Alter incidents table
	log.Println("[Migrations] Altering incidents table...")
	alterIncidents := []string{
		"ALTER TABLE incidents ADD COLUMN IF NOT EXISTS incident_id TEXT;",
		"ALTER TABLE incidents ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'system-monitor';",
		"ALTER TABLE incidents ADD COLUMN IF NOT EXISTS first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
		"ALTER TABLE incidents ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
		"ALTER TABLE incidents ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Open';",
		"ALTER TABLE incidents ADD COLUMN IF NOT EXISTS occurrence_count INT DEFAULT 1;",
		"ALTER TABLE incidents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
	}
	for _, q := range alterIncidents {
		if _, err := db.Exec(q); err != nil {
			log.Printf("[Migrations] ERROR: %v", err)
			log.Fatalf("[Migrations] ERROR: %v", err)
			return fmt.Errorf("migration failed altering incidents table: %w", err)
		}
	}

	// Perform backfills for legacy rows that have NULL values
	backfills := []string{
		`UPDATE incidents SET
			source = COALESCE(source, 'system-monitor'),
			status = COALESCE(status, 'Open'),
			occurrence_count = COALESCE(occurrence_count, 1),
			first_seen = COALESCE(first_seen, created_at, CURRENT_TIMESTAMP),
			last_seen = COALESCE(last_seen, created_at, CURRENT_TIMESTAMP),
			updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
		WHERE source IS NULL OR status IS NULL OR occurrence_count IS NULL OR first_seen IS NULL OR last_seen IS NULL OR updated_at IS NULL;`,
		"UPDATE incidents SET incident_id = 'INC-' || lpad(id::text, 4, '0') WHERE incident_id IS NULL OR incident_id = '';",
	}
	for _, q := range backfills {
		if _, err := db.Exec(q); err != nil {
			log.Printf("[Migrations] ERROR: %v", err)
			log.Fatalf("[Migrations] ERROR: %v", err)
			return fmt.Errorf("migration failed backfilling incidents: %w", err)
		}
	}

	// Apply NOT NULL constraints now that data is backfilled
	notNullConstraints := []string{
		"ALTER TABLE incidents ALTER COLUMN source SET NOT NULL;",
		"ALTER TABLE incidents ALTER COLUMN status SET NOT NULL;",
		"ALTER TABLE incidents ALTER COLUMN occurrence_count SET NOT NULL;",
		"ALTER TABLE incidents ALTER COLUMN first_seen SET NOT NULL;",
		"ALTER TABLE incidents ALTER COLUMN last_seen SET NOT NULL;",
	}
	for _, q := range notNullConstraints {
		if _, err := db.Exec(q); err != nil {
			log.Printf("[Migrations] ERROR: %v", err)
			log.Fatalf("[Migrations] ERROR: %v", err)
			return fmt.Errorf("migration failed applying not null constraints on incidents: %w", err)
		}
	}

	// 4. Alter investigations table
	log.Println("[Migrations] Altering investigations table...")
	alterInvestigations := []string{
		"ALTER TABLE investigations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
	}
	for _, q := range alterInvestigations {
		if _, err := db.Exec(q); err != nil {
			log.Printf("[Migrations] ERROR: %v", err)
			log.Fatalf("[Migrations] ERROR: %v", err)
			return fmt.Errorf("migration failed altering investigations table: %w", err)
		}
	}
	backfillInvestigations := "UPDATE investigations SET updated_at = created_at WHERE updated_at IS NULL;"
	if _, err := db.Exec(backfillInvestigations); err != nil {
		log.Printf("[Migrations] ERROR: %v", err)
		log.Fatalf("[Migrations] ERROR: %v", err)
		return fmt.Errorf("migration failed backfilling investigations: %w", err)
	}

	// 5. Migrate existing copilot questions from incidents to cloud_copilot_sessions
	migrateQuery := `
	INSERT INTO cloud_copilot_sessions (question, response, created_at, updated_at)
	SELECT inc.title, 
	       COALESCE(inv.summary || E'\n\nRoot Cause: ' || inv.root_cause, inc.logs), 
	       inc.created_at, 
	       inc.updated_at
	FROM incidents inc
	LEFT JOIN investigations inv ON inv.incident_id = inc.id
	WHERE inc.title LIKE '%?%' 
	   OR inc.title ILIKE 'what is%' 
	   OR inc.title ILIKE 'difference%' 
	   OR inc.title ILIKE 'explain%' 
	   OR inc.title ILIKE 'how%' 
	   OR inc.title ILIKE 'top%'
	   OR inc.title ILIKE 'what are%';`
	if _, err := db.Exec(migrateQuery); err != nil {
		log.Printf("[Migrations] ERROR during copilot migration: %v", err)
		log.Fatalf("[Migrations] ERROR: %v", err)
		return fmt.Errorf("migration failed during copilot migration query: %w", err)
	}

	// 6. Delete migrated copilot queries from incidents (investigations will cascade delete)
	deleteCopilotQueries := `
	DELETE FROM incidents 
	WHERE title LIKE '%?%' 
	   OR title ILIKE 'what is%' 
	   OR title ILIKE 'difference%' 
	   OR title ILIKE 'explain%' 
	   OR title ILIKE 'how%' 
	   OR title ILIKE 'top%'
	   OR title ILIKE 'what are%';`
	if _, err := db.Exec(deleteCopilotQueries); err != nil {
		log.Printf("[Migrations] ERROR during copilot deletion: %v", err)
		log.Fatalf("[Migrations] ERROR: %v", err)
		return fmt.Errorf("migration failed during copilot deletion: %w", err)
	}

	// 7. Merge duplicate incidents using PL/pgSQL block
	mergeDuplicatesQuery := `
	DO $$
	DECLARE
		r RECORD;
		main_id INT;
		agg_count INT;
		min_first_seen TIMESTAMP;
		max_last_seen TIMESTAMP;
	BEGIN
		-- Find duplicate incident groups
		FOR r IN 
			SELECT LOWER(title) as l_title, source, severity, COUNT(*) as cnt
			FROM incidents
			WHERE LOWER(status) = 'open'
			GROUP BY LOWER(title), source, severity
			HAVING COUNT(*) > 1
		LOOP
			-- Select the earliest incident as the main record
			SELECT id INTO main_id 
			FROM incidents 
			WHERE LOWER(title) = r.l_title AND source = r.source AND severity = r.severity AND LOWER(status) = 'open'
			ORDER BY id ASC
			LIMIT 1;

			-- Aggregate values
			SELECT SUM(occurrence_count), MIN(first_seen), MAX(last_seen)
			INTO agg_count, min_first_seen, max_last_seen
			FROM incidents
			WHERE LOWER(title) = r.l_title AND source = r.source AND severity = r.severity AND LOWER(status) = 'open';

			-- Point all investigations of the duplicate incidents to the main incident
			UPDATE investigations 
			SET incident_id = main_id 
			WHERE incident_id IN (
				SELECT id FROM incidents 
				WHERE LOWER(title) = r.l_title AND source = r.source AND severity = r.severity AND LOWER(status) = 'open' AND id <> main_id
			);

			-- Update the main incident with aggregated count and timestamps
			UPDATE incidents 
			SET occurrence_count = agg_count,
				first_seen = min_first_seen,
				last_seen = max_last_seen,
				updated_at = NOW()
			WHERE id = main_id;

			-- Delete the duplicate incidents
			DELETE FROM incidents 
			WHERE LOWER(title) = r.l_title AND source = r.source AND severity = r.severity AND LOWER(status) = 'open' AND id <> main_id;
		END LOOP;
	END;
	$$;`
	if _, err := db.Exec(mergeDuplicatesQuery); err != nil {
		log.Printf("[Migrations] ERROR during duplicate merging: %v", err)
		log.Fatalf("[Migrations] ERROR: %v", err)
		return fmt.Errorf("migration failed merging duplicate incidents: %w", err)
	}

	// 8. Add unique constraint safely
	uniqueConstraintQuery := `
	DO $$
	BEGIN
		IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_incident_id') THEN
			ALTER TABLE incidents ADD CONSTRAINT unique_incident_id UNIQUE (incident_id);
		END IF;
	END;
	$$;`
	if _, err := db.Exec(uniqueConstraintQuery); err != nil {
		log.Printf("[Migrations] ERROR: %v", err)
		log.Fatalf("[Migrations] ERROR: %v", err)
		return fmt.Errorf("migration failed unique constraint application: %w", err)
	}

	// 9. Create other tables
	queryAgents := `
	CREATE TABLE IF NOT EXISTS agents (
		id SERIAL PRIMARY KEY,
		name TEXT NOT NULL UNIQUE,
		status TEXT NOT NULL,
		workload INT NOT NULL DEFAULT 0
	);`
	if _, err := db.Exec(queryAgents); err != nil {
		log.Printf("[Migrations] ERROR: %v", err)
		log.Fatalf("[Migrations] ERROR: %v", err)
		return fmt.Errorf("migration failed creating agents table: %w", err)
	}

	queryResources := `
	CREATE TABLE IF NOT EXISTS resources (
		id SERIAL PRIMARY KEY,
		name TEXT NOT NULL UNIQUE,
		cloud TEXT NOT NULL,
		type TEXT NOT NULL,
		status TEXT NOT NULL
	);`
	if _, err := db.Exec(queryResources); err != nil {
		log.Printf("[Migrations] ERROR: %v", err)
		log.Fatalf("[Migrations] ERROR: %v", err)
		return fmt.Errorf("migration failed creating resources table: %w", err)
	}

	queryDockerStats := `
	CREATE TABLE IF NOT EXISTS docker_container_stats (
		id SERIAL PRIMARY KEY,
		container_id TEXT NOT NULL,
		container_name TEXT NOT NULL,
		cpu_percent DOUBLE PRECISION NOT NULL,
		memory_percent DOUBLE PRECISION NOT NULL,
		network_io TEXT NOT NULL,
		block_io TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`
	if _, err := db.Exec(queryDockerStats); err != nil {
		log.Printf("[Migrations] ERROR: %v", err)
		log.Fatalf("[Migrations] ERROR: %v", err)
		return fmt.Errorf("migration failed creating docker_container_stats table: %w", err)
	}

	queryK8sPodStats := `
	CREATE TABLE IF NOT EXISTS kubernetes_pod_stats (
		id SERIAL PRIMARY KEY,
		pod_name TEXT NOT NULL,
		namespace TEXT NOT NULL,
		cpu_percent DOUBLE PRECISION NOT NULL,
		memory_percent DOUBLE PRECISION NOT NULL,
		restart_count INT NOT NULL,
		status TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`
	if _, err := db.Exec(queryK8sPodStats); err != nil {
		log.Printf("[Migrations] ERROR: %v", err)
		log.Fatalf("[Migrations] ERROR: %v", err)
		return fmt.Errorf("migration failed creating kubernetes_pod_stats table: %w", err)
	}

	queryK8sClusterStats := `
	CREATE TABLE IF NOT EXISTS kubernetes_cluster_stats (
		id SERIAL PRIMARY KEY,
		node_count INT NOT NULL,
		ready_node_count INT NOT NULL,
		pod_count INT NOT NULL,
		cpu_percent DOUBLE PRECISION NOT NULL,
		memory_percent DOUBLE PRECISION NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`
	if _, err := db.Exec(queryK8sClusterStats); err != nil {
		log.Printf("[Migrations] ERROR: %v", err)
		log.Fatalf("[Migrations] ERROR: %v", err)
		return fmt.Errorf("migration failed creating kubernetes_cluster_stats table: %w", err)
	}

	// 9.5 Create prometheus_snapshots table
	log.Println("[Migrations] Creating prometheus_snapshots...")
	queryPrometheusSnapshots := `
	CREATE TABLE IF NOT EXISTS prometheus_snapshots (
		id SERIAL PRIMARY KEY,
		connected BOOLEAN NOT NULL,
		targets_total INT NOT NULL DEFAULT 0,
		targets_healthy INT NOT NULL DEFAULT 0,
		metrics_collected INT NOT NULL DEFAULT 0,
		alerts_active INT NOT NULL DEFAULT 0,
		query_latency_ms DOUBLE PRECISION NOT NULL DEFAULT 0.0,
		cpu_average DOUBLE PRECISION NOT NULL DEFAULT 0.0,
		memory_average DOUBLE PRECISION NOT NULL DEFAULT 0.0,
		network_ingress_bytes DOUBLE PRECISION NOT NULL DEFAULT 0.0,
		network_egress_bytes DOUBLE PRECISION NOT NULL DEFAULT 0.0,
		restart_count INT NOT NULL DEFAULT 0,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`
	if _, err := db.Exec(queryPrometheusSnapshots); err != nil {
		log.Printf("[Migrations] ERROR: %v", err)
		log.Fatalf("[Migrations] ERROR: %v", err)
		return fmt.Errorf("migration failed creating prometheus_snapshots table: %w", err)
	}

	// 9.6 Create cloud_connections and platform_settings tables
	log.Println("[Migrations] Creating cloud_connections and platform_settings...")
	queryCloudConnections := `
	CREATE TABLE IF NOT EXISTS cloud_connections (
		id SERIAL PRIMARY KEY,
		provider VARCHAR(50) NOT NULL UNIQUE,
		connection_type VARCHAR(100) NOT NULL,
		encrypted_credentials TEXT NOT NULL,
		status VARCHAR(50) NOT NULL,
		last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		metadata JSONB DEFAULT '{}'::jsonb,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
	CREATE TABLE IF NOT EXISTS platform_settings (
		key VARCHAR(100) PRIMARY KEY,
		value VARCHAR(255) NOT NULL
	);`
	if _, err := db.Exec(queryCloudConnections); err != nil {
		log.Printf("[Migrations] ERROR: %v", err)
		log.Fatalf("[Migrations] ERROR: %v", err)
		return fmt.Errorf("migration failed to create cloud_connections/settings: %w", err)
	}

	// Seed default system_mode
	_, _ = db.Exec("INSERT INTO platform_settings (key, value) VALUES ('system_mode', 'DEMO') ON CONFLICT (key) DO NOTHING")

	// Create Azure integration tables
	log.Println("[Migrations] Creating Azure integration tables...")
	queryAzureTables := `
	CREATE TABLE IF NOT EXISTS azure_subscriptions (
		id TEXT PRIMARY KEY,
		subscription_id TEXT NOT NULL,
		display_name TEXT NOT NULL,
		state TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS azure_resource_groups (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		location TEXT NOT NULL,
		provisioning_state TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS azure_vms (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		location TEXT NOT NULL,
		status TEXT NOT NULL,
		size TEXT NOT NULL,
		os_type TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS azure_storage_accounts (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		location TEXT NOT NULL,
		status TEXT NOT NULL,
		sku TEXT NOT NULL,
		access_tier TEXT NOT NULL,
		public_network_access TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS azure_aks_clusters (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		location TEXT NOT NULL,
		status TEXT NOT NULL,
		version TEXT NOT NULL,
		node_count INT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS azure_costs (
		id SERIAL PRIMARY KEY,
		date DATE NOT NULL,
		resource_group TEXT NOT NULL,
		cost DOUBLE PRECISION NOT NULL,
		currency TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS azure_security_findings (
		id TEXT PRIMARY KEY,
		severity TEXT NOT NULL,
		resource TEXT NOT NULL,
		recommendation TEXT NOT NULL,
		status TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS azure_recommendations (
		id TEXT PRIMARY KEY,
		resource TEXT NOT NULL,
		category TEXT NOT NULL,
		recommendation TEXT NOT NULL,
		impact TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS azure_providers (
		namespace TEXT PRIMARY KEY,
		registration_state TEXT NOT NULL
	);`
	if _, err := db.Exec(queryAzureTables); err != nil {
		log.Printf("[Migrations] ERROR creating Azure tables: %v", err)
		return fmt.Errorf("migration failed creating azure tables: %w", err)
	}

	log.Println("[Migrations] Creating AWS integration tables...")
	queryAWSTables := `
	CREATE TABLE IF NOT EXISTS aws_accounts (
		id TEXT PRIMARY KEY,
		arn TEXT NOT NULL,
		user_id TEXT NOT NULL,
		is_live BOOLEAN DEFAULT FALSE
	);
	CREATE TABLE IF NOT EXISTS aws_regions (
		name TEXT NOT NULL,
		is_live BOOLEAN DEFAULT FALSE,
		PRIMARY KEY (name, is_live)
	);
	CREATE TABLE IF NOT EXISTS aws_ec2_instances (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		region TEXT NOT NULL,
		state TEXT NOT NULL,
		instance_type TEXT NOT NULL,
		tags TEXT NOT NULL,
		is_live BOOLEAN DEFAULT FALSE
	);
	CREATE TABLE IF NOT EXISTS aws_s3_buckets (
		name TEXT NOT NULL,
		region TEXT NOT NULL,
		public_access TEXT NOT NULL,
		is_live BOOLEAN DEFAULT FALSE,
		PRIMARY KEY (name, is_live)
	);
	CREATE TABLE IF NOT EXISTS aws_vpcs (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		region TEXT NOT NULL,
		state TEXT NOT NULL,
		cidr_block TEXT NOT NULL,
		is_live BOOLEAN DEFAULT FALSE
	);
	CREATE TABLE IF NOT EXISTS aws_iam_users (
		arn TEXT PRIMARY KEY,
		username TEXT NOT NULL,
		mfa_enabled BOOLEAN DEFAULT FALSE,
		last_login TIMESTAMP,
		is_live BOOLEAN DEFAULT FALSE
	);
	CREATE TABLE IF NOT EXISTS aws_iam_roles (
		arn TEXT PRIMARY KEY,
		role_name TEXT NOT NULL,
		is_live BOOLEAN DEFAULT FALSE
	);
	CREATE TABLE IF NOT EXISTS aws_iam_policies (
		arn TEXT PRIMARY KEY,
		policy_name TEXT NOT NULL,
		is_live BOOLEAN DEFAULT FALSE
	);
	CREATE TABLE IF NOT EXISTS aws_iam_access_keys (
		access_key_id TEXT PRIMARY KEY,
		username TEXT NOT NULL,
		status TEXT NOT NULL,
		last_used_date TIMESTAMP,
		is_live BOOLEAN DEFAULT FALSE
	);
	CREATE TABLE IF NOT EXISTS aws_security_findings (
		id TEXT PRIMARY KEY,
		severity TEXT NOT NULL,
		resource TEXT NOT NULL,
		recommendation TEXT NOT NULL,
		status TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS aws_recommendations (
		id TEXT PRIMARY KEY,
		resource TEXT NOT NULL,
		category TEXT NOT NULL,
		recommendation TEXT NOT NULL,
		impact TEXT NOT NULL
	);`
	if _, err := db.Exec(queryAWSTables); err != nil {
		log.Printf("[Migrations] ERROR creating AWS tables: %v", err)
		return fmt.Errorf("migration failed creating aws tables: %w", err)
	}

	// Alter table resource groups to add tags column if not exists
	if _, err := db.Exec("ALTER TABLE azure_resource_groups ADD COLUMN IF NOT EXISTS tags TEXT;"); err != nil {
		log.Printf("[Migrations] WARNING altering azure_resource_groups: %v", err)
	}

	// Alter Azure tables to add is_live column and adjust primary keys
	alterQueries := []string{
		"ALTER TABLE azure_subscriptions ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE;",
		"ALTER TABLE azure_resource_groups ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE;",
		"ALTER TABLE azure_vms ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE;",
		"ALTER TABLE azure_storage_accounts ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE;",
		"ALTER TABLE azure_aks_clusters ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE;",
		"ALTER TABLE azure_providers ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE;",
		"ALTER TABLE azure_providers DROP CONSTRAINT IF EXISTS azure_providers_pkey;",
		"ALTER TABLE azure_providers ADD CONSTRAINT azure_providers_pkey PRIMARY KEY (namespace, is_live);",
	}
	for _, q := range alterQueries {
		if _, err := db.Exec(q); err != nil {
			log.Printf("[Migrations] WARNING executing alter query: %s, error: %v", q, err)
		}
	}

	// 10. Create indexes
	incidentIndexes := []string{
		"CREATE INDEX IF NOT EXISTS idx_incidents_title ON incidents(title);",
		"CREATE INDEX IF NOT EXISTS idx_incidents_incident_id ON incidents(incident_id);",
		"CREATE INDEX IF NOT EXISTS idx_incidents_source ON incidents(source);",
		"CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at);",
		"CREATE INDEX IF NOT EXISTS idx_incidents_updated_at ON incidents(updated_at);",
		"CREATE INDEX IF NOT EXISTS idx_investigations_created_at ON investigations(created_at);",
		"CREATE INDEX IF NOT EXISTS idx_investigations_updated_at ON investigations(updated_at);",
		"CREATE INDEX IF NOT EXISTS idx_copilot_created_at ON cloud_copilot_sessions(created_at);",
		"CREATE INDEX IF NOT EXISTS idx_memory_records_created_at ON memory_records(created_at);",
		"CREATE INDEX IF NOT EXISTS idx_docker_stats_created_at ON docker_container_stats(created_at);",
		"CREATE INDEX IF NOT EXISTS idx_memory_records_updated_at ON memory_records(updated_at);",
		"CREATE INDEX IF NOT EXISTS idx_k8s_pod_stats_created_at ON kubernetes_pod_stats(created_at);",
		"CREATE INDEX IF NOT EXISTS idx_k8s_cluster_stats_created_at ON kubernetes_cluster_stats(created_at);",
		"CREATE INDEX IF NOT EXISTS idx_prometheus_snapshots_created_at ON prometheus_snapshots(created_at);",
	}
	for _, q := range incidentIndexes {
		if _, err := db.Exec(q); err != nil {
			log.Printf("[Migrations] ERROR: %v", err)
			log.Fatalf("[Migrations] ERROR: %v", err)
			return fmt.Errorf("migration failed creating indexes: %w", err)
		}
	}

	// 11. Seed initial data
	if err := seedInitialData(db); err != nil {
		log.Printf("[Migrations] ERROR: %v", err)
		log.Fatalf("[Migrations] ERROR: %v", err)
		return fmt.Errorf("migration seeding failed: %w", err)
	}

	log.Println("[Migrations] Migration completed successfully.")
	return nil
}

func seedInitialData(db *sql.DB) error {
	var count int
	var err error

	// Seed agents
	err = db.QueryRow("SELECT COUNT(*) FROM agents").Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check agents count: %w", err)
	}
	if count == 0 {
		agents := []struct {
			name     string
			status   string
			workload int
		}{
			{"Architect Agent", "idle", 0},
			{"Incident Investigator Agent", "active", 78},
			{"Security Agent", "active", 90},
			{"Reliability Agent", "active", 82},
			{"Performance Agent", "idle", 100},
			{"Cost Agent", "idle", 100},
			{"Memory Agent", "active", 54},
		}
		for _, a := range agents {
			_, err = db.Exec("INSERT INTO agents (name, status, workload) VALUES ($1, $2, $3)", a.name, a.status, a.workload)
			if err != nil {
				return fmt.Errorf("failed to seed agent %s: %w", a.name, err)
			}
		}
		log.Println("Default agents seeded successfully")
	}

	// Seed resources
	err = db.QueryRow("SELECT COUNT(*) FROM resources").Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check resources count: %w", err)
	}
	if count == 0 {
		resources := []struct {
			name   string
			cloud  string
			rType  string
			status string
		}{
			{"AKS Production Cluster", "Azure", "Azure Kubernetes Service", "Running"},
			{"Azure PostgreSQL", "Azure", "Database", "Healthy"},
			{"EKS Staging Cluster", "AWS", "Amazon Elastic Kubernetes Service", "Running"},
			{"RDS PostgreSQL", "AWS", "Database", "Healthy"},
			{"S3 Backup Storage", "AWS", "Object Storage", "Available"},
			{"Blob Storage", "Azure", "Storage", "Available"},
			{"Application Gateway", "Azure", "Network", "Healthy"},
		}
		for _, r := range resources {
			_, err = db.Exec("INSERT INTO resources (name, cloud, type, status) VALUES ($1, $2, $3, $4)",
				r.name, r.cloud, r.rType, r.status)
			if err != nil {
				return fmt.Errorf("failed to seed resource %s: %w", r.name, err)
			}
		}
		log.Println("Default cloud resources seeded successfully")
	}

	// Seed default incidents
	err = db.QueryRow("SELECT COUNT(*) FROM incidents").Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check incidents count: %w", err)
	}
	if count == 0 {
		incidents := []struct {
			title    string
			source   string
			severity string
			logs     string
		}{
			{"CPU Spike", "kube-us-east-cluster", "High", "CPU utilization exceeded 95% on checkout-service."},
			{"Memory Exhaustion", "rds-aurora-postgres", "Critical", "Out of memory error in RDS Aurora database."},
			{"TLS Certificate Expiring", "cert-manager-production", "Medium", "SSL certificate expiring in 15 days on cert-manager."},
		}
		for _, inc := range incidents {
			_, err = db.Exec("INSERT INTO incidents (title, source, severity, logs, status, occurrence_count, first_seen, last_seen, created_at, updated_at) VALUES ($1, $2, $3, $4, 'Open', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
				inc.title, inc.source, inc.severity, inc.logs)
			if err != nil {
				return fmt.Errorf("failed to seed default incident %s: %w", inc.title, err)
			}
		}
		// Backfill incident IDs
		_, err = db.Exec("UPDATE incidents SET incident_id = 'INC-' || lpad(id::text, 4, '0') WHERE incident_id IS NULL OR incident_id = '';")
		if err != nil {
			return fmt.Errorf("failed to backfill default incident ids: %w", err)
		}
		log.Println("Default incidents seeded successfully")
	}

	// Seed default copilot sessions if empty
	var copilotCount int
	err = db.QueryRow("SELECT COUNT(*) FROM cloud_copilot_sessions").Scan(&copilotCount)
	if err == nil && copilotCount == 0 {
		defaultCopilots := []struct {
			question string
			response string
		}{
			{
				"What is AWS?",
				"Amazon Web Services (AWS) is a comprehensive, evolving cloud computing platform provided by Amazon. It includes a mixture of infrastructure-as-a-service (IaaS), platform-as-a-service (PaaS), and packaged software-as-a-service (SaaS) offerings.",
			},
			{
				"Difference Between EC2 and S3",
				"Amazon EC2 (Elastic Compute Cloud) provides resizable compute capacity in the cloud (virtual servers), whereas Amazon S3 (Simple Storage Service) is an object storage service designed for storing and retrieving any amount of data from anywhere on the web.",
			},
		}
		for _, cop := range defaultCopilots {
			_, err = db.Exec("INSERT INTO cloud_copilot_sessions (question, response, created_at, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP - INTERVAL '2 minutes', CURRENT_TIMESTAMP - INTERVAL '2 minutes')",
				cop.question, cop.response)
			if err != nil {
				log.Printf("[Database Error] Failed to seed copilot session: %v", err)
			}
		}
		log.Println("Default copilot sessions seeded successfully")
	}

	// Seed default memory records if empty
	var memCount int
	err = db.QueryRow("SELECT COUNT(*) FROM memory_records").Scan(&memCount)
	if err == nil && memCount == 0 {
		memories := []struct {
			title    string
			category string
			content  string
		}{
			{
				"Kubernetes Pod Out-Of-Memory (OOM) Runbook",
				"runbook",
				"Details escalation paths and memory limits adjustments for memory-intensive Node applications. Recommends configuring memory requests to 1Gi and limits to 2Gi to handle payload spike loops.",
			},
			{
				"Inc-410: Auth-Service memory leak outage logs",
				"incident",
				"Historical incident from Oct 12: microservice experienced a slow leak in garbage collection cycles. Temporary mitigation: automated worker thread cycling. Final fix: replaced local session caching with Redis.",
			},
			{
				"Production Helm Values manifest configuration",
				"config",
				"Contains memory allocations and autoscaling limits for auth-service-chart deployments. Limits are set to target CPU: 80% and Memory: 75% for horizontal pod autoscalers.",
			},
		}
		for _, m := range memories {
			_, err = db.Exec("INSERT INTO memory_records (title, category, content, created_at, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
				m.title, m.category, m.content)
			if err != nil {
				log.Printf("[Database Error] Failed to seed memory record: %v", err)
			}
		}
		log.Println("Default memory records seeded successfully")
	}

	// Seed default Azure data if empty
	var azureVMCount int
	err = db.QueryRow("SELECT COUNT(*) FROM azure_vms WHERE is_live = FALSE").Scan(&azureVMCount)
	if err == nil && azureVMCount == 0 {
		log.Println("[Migrations] Seeding default Azure mock data...")
		_, _ = db.Exec("INSERT INTO azure_subscriptions (id, subscription_id, display_name, state) VALUES ('/subscriptions/sub-demoid-1234', 'sub-demoid-1234', 'Azure for Students', 'Enabled')")
		
		_, _ = db.Exec("INSERT INTO azure_resource_groups (id, name, location, provisioning_state) VALUES " +
			"('/subscriptions/sub-demoid-1234/resourceGroups/rg-aegis-prod', 'rg-aegis-prod', 'eastus', 'Succeeded')," +
			"('/subscriptions/sub-demoid-1234/resourceGroups/rg-aegis-staging', 'rg-aegis-staging', 'eastus', 'Succeeded')," +
			"('/subscriptions/sub-demoid-1234/resourceGroups/rg-aegis-shared', 'rg-aegis-shared', 'centralus', 'Succeeded')")

		_, _ = db.Exec("INSERT INTO azure_vms (id, name, location, status, size, os_type) VALUES " +
			"('/subscriptions/sub-demoid-1234/resourceGroups/rg-aegis-prod/providers/Microsoft.Compute/virtualMachines/vm-aegis-prod-01', 'vm-aegis-prod-01', 'eastus', 'VM running', 'Standard_D2s_v5', 'Linux')," +
			"('/subscriptions/sub-demoid-1234/resourceGroups/rg-aegis-prod/providers/Microsoft.Compute/virtualMachines/vm-aegis-prod-02', 'vm-aegis-prod-02', 'eastus', 'VM stopped', 'Standard_D2s_v5', 'Linux')")

		_, _ = db.Exec("INSERT INTO azure_storage_accounts (id, name, location, status, sku, access_tier, public_network_access) VALUES " +
			"('/subscriptions/sub-demoid-1234/resourceGroups/rg-aegis-prod/providers/Microsoft.Storage/storageAccounts/saaegisprodlogs', 'saaegisprodlogs', 'eastus', 'Available', 'Standard_LRS', 'Hot', 'Disabled')," +
			"('/subscriptions/sub-demoid-1234/resourceGroups/rg-aegis-shared/providers/Microsoft.Storage/storageAccounts/saaegissharedassets', 'saaegissharedassets', 'centralus', 'Available', 'Standard_GRS', 'Hot', 'Enabled')")

		_, _ = db.Exec("INSERT INTO azure_aks_clusters (id, name, location, status, version, node_count) VALUES " +
			"('/subscriptions/sub-demoid-1234/resourceGroups/rg-aegis-prod/providers/Microsoft.ContainerService/managedClusters/aks-aegis-prod', 'aks-aegis-prod', 'eastus', 'Succeeded', '1.27.3', 3)")

		_, _ = db.Exec("INSERT INTO azure_costs (date, resource_group, cost, currency) VALUES " +
			"(CURRENT_DATE - INTERVAL '2 days', 'rg-aegis-prod', 24.50, 'USD')," +
			"(CURRENT_DATE - INTERVAL '2 days', 'rg-aegis-staging', 8.20, 'USD')," +
			"(CURRENT_DATE - INTERVAL '2 days', 'rg-aegis-shared', 4.10, 'USD')," +
			"(CURRENT_DATE - INTERVAL '1 days', 'rg-aegis-prod', 25.10, 'USD')," +
			"(CURRENT_DATE - INTERVAL '1 days', 'rg-aegis-staging', 8.25, 'USD')," +
			"(CURRENT_DATE - INTERVAL '1 days', 'rg-aegis-shared', 4.15, 'USD')," +
			"(CURRENT_DATE, 'rg-aegis-prod', 26.30, 'USD')," +
			"(CURRENT_DATE, 'rg-aegis-staging', 9.10, 'USD')," +
			"(CURRENT_DATE, 'rg-aegis-shared', 4.20, 'USD')")

		_, _ = db.Exec("INSERT INTO azure_security_findings (id, severity, resource, recommendation, status) VALUES " +
			"('sec-find-001', 'High', 'vm-aegis-prod-02', 'Virtual machine is stopped unexpectedly. Verify power state or start service if necessary.', 'Open')," +
			"('sec-find-002', 'Medium', 'saaegissharedassets', 'Storage account allows public access. Review network firewall rules and disable anonymous access.', 'Open')," +
			"('sec-find-003', 'Low', 'saaegisprodlogs', 'Missing tags on resource. Set owner and environment tags for compliance visibility.', 'Open')")

		_, _ = db.Exec("INSERT INTO azure_recommendations (id, resource, category, recommendation, impact) VALUES " +
			"('rec-001', 'vm-aegis-prod-02', 'Compute', 'VM stopped unexpectedly: Review activity logs and start vm if required.', 'High')," +
			"('rec-002', 'saaegissharedassets', 'Storage', 'Storage account publicly accessible: Review network rules and disable public blob access.', 'Medium')," +
			"('rec-003', 'saaegisprodlogs', 'Tagging', 'Missing tags: Set Owner/Env tags for cost tracking compliance.', 'Low')")

		// Seed 16 mock providers
		_, _ = db.Exec("INSERT INTO azure_providers (namespace, registration_state) VALUES " +
			"('Microsoft.Compute', 'Registered')," +
			"('Microsoft.Storage', 'Registered')," +
			"('Microsoft.ContainerService', 'Registered')," +
			"('Microsoft.Network', 'Registered')," +
			"('Microsoft.Resources', 'Registered')," +
			"('Microsoft.Web', 'Registered')," +
			"('Microsoft.Sql', 'Registered')," +
			"('Microsoft.DocumentDB', 'Registered')," +
			"('Microsoft.Insights', 'Registered')," +
			"('Microsoft.KeyVault', 'Registered')," +
			"('Microsoft.Authorization', 'Registered')," +
			"('Microsoft.ManagedIdentity', 'Registered')," +
			"('Microsoft.OperationalInsights', 'Registered')," +
			"('Microsoft.OperationsManagement', 'Registered')," +
			"('Microsoft.Security', 'Registered')," +
			"('Microsoft.AlertsManagement', 'Registered')")

		// Seed student policies informational finding
		_, _ = db.Exec("INSERT INTO azure_security_findings (id, severity, resource, recommendation, status) VALUES " +
			"('sec-find-student-policy', 'Low', 'Azure Subscription', 'Some Azure resource types may be restricted under Azure for Students subscription policies.', 'Informational')")

		// Seed student policies recommendations
		_, _ = db.Exec("INSERT INTO azure_recommendations (id, resource, category, recommendation, impact) VALUES " +
			"('rec-student-1', 'Azure Subscription', 'General', 'Continue using Resource Groups for testing.', 'Low')," +
			"('rec-student-2', 'Azure Subscription', 'General', 'Use read-only discovery APIs.', 'Low')," +
			"('rec-student-3', 'Azure Subscription', 'General', 'Use demo mode when resources are unavailable.', 'Low')," +
			"('rec-student-4', 'Azure Subscription', 'General', 'Create resources only when subscription policies permit.', 'Low')")

		log.Println("[Migrations] Azure mock data seeded successfully")
	}

	// Seed default AWS data if empty
	var awsVMCount int
	err = db.QueryRow("SELECT COUNT(*) FROM aws_ec2_instances WHERE is_live = FALSE").Scan(&awsVMCount)
	if err == nil && awsVMCount == 0 {
		log.Println("[Migrations] Seeding default AWS mock data...")
		_, _ = db.Exec("INSERT INTO aws_accounts (id, arn, user_id, is_live) VALUES ('123456789012', 'arn:aws:iam::123456789012:root', 'root', FALSE)")
		_, _ = db.Exec("INSERT INTO aws_regions (name, is_live) VALUES ('us-east-1', FALSE)")
		_, _ = db.Exec("INSERT INTO aws_vpcs (id, name, region, state, cidr_block, is_live) VALUES ('vpc-0a1b2c3d4e5f6g7h8', 'demo-vpc', 'us-east-1', 'available', '10.0.0.0/16', FALSE)")
		_, _ = db.Exec("INSERT INTO aws_s3_buckets (name, region, public_access, is_live) VALUES ('demo-public-bucket', 'us-east-1', 'Public', FALSE)")
		_, _ = db.Exec("INSERT INTO aws_iam_users (arn, username, mfa_enabled, last_login, is_live) VALUES " +
			"('arn:aws:iam::123456789012:user/admin-user', 'admin-user', FALSE, CURRENT_TIMESTAMP - INTERVAL '1 days', FALSE)," +
			"('arn:aws:iam::123456789012:user/sre-user', 'sre-user', TRUE, CURRENT_TIMESTAMP, FALSE)")
		_, _ = db.Exec("INSERT INTO aws_iam_roles (arn, role_name, is_live) VALUES " +
			"('arn:aws:iam::123456789012:role/admin-role', 'admin-role', FALSE)," +
			"('arn:aws:iam::123456789012:role/ec2-readonly-role', 'ec2-readonly-role', FALSE)," +
			"('arn:aws:iam::123456789012:role/s3-access-role', 's3-access-role', FALSE)," +
			"('arn:aws:iam::123456789012:role/rds-monitoring-role', 'rds-monitoring-role', FALSE)," +
			"('arn:aws:iam::123456789012:role/lambda-execution-role', 'lambda-execution-role', FALSE)")
		_, _ = db.Exec("INSERT INTO aws_iam_policies (arn, policy_name, is_live) VALUES " +
			"('arn:aws:iam::aws:policy/AdministratorAccess', 'AdministratorAccess', FALSE)," +
			"('arn:aws:iam::aws:policy/AmazonEC2ReadOnlyAccess', 'AmazonEC2ReadOnlyAccess', FALSE)," +
			"('arn:aws:iam::aws:policy/AmazonS3FullAccess', 'AmazonS3FullAccess', FALSE)")
		_, _ = db.Exec("INSERT INTO aws_iam_access_keys (access_key_id, username, status, last_used_date, is_live) VALUES " +
			"('AKIAIOSFODNN7EXAMPLE', 'admin-user', 'Active', CURRENT_TIMESTAMP - INTERVAL '100 days', FALSE)," +
			"('AKIAIADSFODNN7EXAMPLE', 'sre-user', 'Active', CURRENT_TIMESTAMP, FALSE)")

		_, _ = db.Exec("INSERT INTO aws_security_findings (id, severity, resource, recommendation, status) VALUES " +
			"('sec-find-aws-s3-public', 'Critical', 'demo-public-bucket', 'S3 bucket publicly accessible. Enable Block Public Access.', 'Open')," +
			"('sec-find-aws-mfa-admin', 'High', 'admin-user', 'IAM User admin-user without MFA. Enable MFA immediately.', 'Open')," +
			"('sec-find-aws-admin-policy', 'High', 'admin-role', 'IAM role has AdministratorAccess policy. Apply least privilege permissions.', 'Open')," +
			"('sec-find-aws-unused-key', 'Medium', 'AKIAIOSFODNN7EXAMPLE', 'Unused IAM access key detected (inactive > 90 days). Rotate or deactivate.', 'Open')")

		_, _ = db.Exec("INSERT INTO aws_recommendations (id, resource, category, recommendation, impact) VALUES " +
			"('rec-aws-s3-public', 'demo-public-bucket', 'Storage', 'S3 bucket publicly accessible: Enable Block Public Access.', 'Critical')," +
			"('rec-aws-mfa-admin', 'admin-user', 'IAM', 'IAM user without MFA: Enable MFA and rotate credentials.', 'High')," +
			"('rec-aws-admin-policy', 'admin-role', 'IAM', 'IAM role has AdministratorAccess policy: Apply least privilege permissions.', 'High')," +
			"('rec-aws-unused-key', 'AKIAIOSFODNN7EXAMPLE', 'IAM', 'Unused IAM access key: Rotate or deactivate credentials.', 'Medium')")

		log.Println("[Migrations] AWS mock data seeded successfully")
	}

	return nil
}
