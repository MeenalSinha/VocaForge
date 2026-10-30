# Create Cloud SQL PostgreSQL instance and configure Cloud Run
$env:CLOUDSDK_METRICS_ENVIRONMENT = "datacloud.antigravity"

$instanceName = "vocaforge-db"
$projectName = "spatialguard"
$region = "us-central1"
$dbName = "vocaforge"
$dbUser = "postgres"

# Generate a secure 24-char password
$chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
$rng = New-Object System.Random
$dbPassword = -join ((1..24) | ForEach-Object { $chars[$rng.Next(0, $chars.Length)] })

Write-Host "Creating Cloud SQL PostgreSQL instance '$instanceName' in project '$projectName'..."
Write-Host "Tier: db-f1-micro, Edition: ENTERPRISE, Region: $region, Database: $dbName"

# 1. Create Cloud SQL instance with Enterprise edition for shared core (db-f1-micro)
gcloud sql instances create $instanceName `
  --project=$projectName `
  --edition=ENTERPRISE `
  --database-version=POSTGRES_16 `
  --tier=db-f1-micro `
  --region=$region `
  --storage-size=10GB `
  --storage-type=SSD `
  --root-password=$dbPassword `
  --authorized-networks="0.0.0.0/0" `
  --quiet

if ($LASTEXITCODE -ne 0) {
    Write-Host "Creation failed, checking error..."
    exit 1
}

# 2. Create the database
Write-Host "Creating database '$dbName' on instance '$instanceName'..."
gcloud sql databases create $dbName --instance=$instanceName --project=$projectName --quiet

# 3. Get Public IP
$ip = (gcloud sql instances describe $instanceName --project=$projectName --format="value(ipAddresses[0].ipAddress)").Trim()
Write-Host "Cloud SQL Public IP: $ip"

# 4. Construct Connection Strings
$dbUrl = "postgresql://${dbUser}:${dbPassword}@${ip}:5432/${dbName}?sslmode=require"

# Save connection info to .env.cloudsql (gitignored)
"DATABASE_URL=$dbUrl`nCLOUDSQL_IP=$ip`nCLOUDSQL_INSTANCE=${projectName}:${region}:${instanceName}" | Out-File -FilePath .env.cloudsql -Encoding utf8
Write-Host "Saved credentials to .env.cloudsql"

# 5. Output the result
Write-Host "Cloud SQL instance ready!"
Write-Host "Connection URL configured."
