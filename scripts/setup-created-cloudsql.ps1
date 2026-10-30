# Setup and initialize Cloud SQL instance vocaforge-db once runnable
$env:CLOUDSDK_METRICS_ENVIRONMENT = "datacloud.antigravity"

$instanceName = "vocaforge-db"
$projectName = "spatialguard"
$region = "us-central1"
$dbName = "vocaforge"
$dbUser = "postgres"

Write-Host "Waiting for Cloud SQL instance '$instanceName' to become RUNNABLE..."

do {
    Start-Sleep -Seconds 15
    $state = (gcloud sql instances describe $instanceName --project=$projectName --format="value(state)").Trim()
    Write-Host "Current state: $state"
} while ($state -eq "PENDING_CREATE")

if ($state -ne "RUNNABLE") {
    Write-Host "Instance is not RUNNABLE (state: $state)"
    exit 1
}

Write-Host "Instance is RUNNABLE! Configuring credentials and database..."

# 1. Generate strong 24-char password and set it
$chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
$rng = New-Object System.Random
$dbPassword = -join ((1..24) | ForEach-Object { $chars[$rng.Next(0, $chars.Length)] })

Write-Host "Setting password for user '$dbUser'..."
gcloud sql users set-password $dbUser `
  --instance=$instanceName `
  --project=$projectName `
  --password=$dbPassword `
  --quiet

# 2. Create the database 'vocaforge' if not exists
Write-Host "Ensuring database '$dbName' exists..."
gcloud sql databases create $dbName --instance=$instanceName --project=$projectName --quiet 2>$null

# 3. Ensure authorized networks allows public IP connections
Write-Host "Configuring authorized networks for remote access..."
gcloud sql instances patch $instanceName `
  --project=$projectName `
  --authorized-networks="0.0.0.0/0" `
  --quiet

# 4. Get Public IP
$ip = (gcloud sql instances describe $instanceName --project=$projectName --format="value(ipAddresses[0].ipAddress)").Trim()
Write-Host "Cloud SQL Public IP: $ip"

# 5. Construct Connection Strings
$dbUrl = "postgresql://${dbUser}:${dbPassword}@${ip}:5432/${dbName}?sslmode=require"

# Save connection info to .env.cloudsql (gitignored)
"DATABASE_URL=$dbUrl`nCLOUDSQL_IP=$ip`nCLOUDSQL_INSTANCE=${projectName}:${region}:${instanceName}" | Out-File -FilePath .env.cloudsql -Encoding utf8
Write-Host "Saved credentials to .env.cloudsql"

# 6. Run Database Migrations
Write-Host "Running database migrations against Cloud SQL..."
$env:DATABASE_URL = $dbUrl
$env:DATABASE_SSL = "require"
npm run db:migrate

# 7. Seed Demo Workspace
Write-Host "Seeding demo workspace..."
npm run demo:setup

# 8. Update Cloud Run service with DATABASE_URL
Write-Host "Updating Cloud Run service 'vocaforge' with production DATABASE_URL..."
gcloud run services update vocaforge `
  --project=$projectName `
  --region=$region `
  --update-env-vars "DATABASE_URL=$dbUrl,DATABASE_SSL=require" `
  --quiet

Write-Host "VocaForge Cloud Run database connection complete!"
