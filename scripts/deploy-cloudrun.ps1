# Deploy VocaForge to Google Cloud Run
$env:CLOUDSDK_METRICS_ENVIRONMENT = "datacloud.antigravity"

$envFile = Get-Content .env.local -Raw
$elKey = ""
$groqKey = ""
$genModel = "openai/gpt-oss-120b"

foreach ($line in ($envFile -split "`n")) {
    $line = $line.Trim()
    if ($line -match "^ELEVENLABS_API_KEY=(.+)$") { $elKey = $matches[1].Trim() }
    if ($line -match "^GROQ_API_KEY=(.+)$") { $groqKey = $matches[1].Trim() }
    if ($line -match "^GENERATION_MODEL=(.+)$") { $genModel = $matches[1].Trim() }
}

Write-Host "Starting Cloud Run deployment for service 'vocaforge' in project 'spatialguard' (region: us-central1)..."

$envVars = "ELEVENLABS_API_KEY=$elKey,ELEVENLABS_API_BASE_URL=https://api.elevenlabs.io,GENERATION_PROVIDER=groq,GROQ_API_KEY=$groqKey,GENERATION_MODEL=$genModel,VOCAFORGE_ALLOW_UNAUTHENTICATED=true,LOG_LEVEL=info"

gcloud run deploy vocaforge `
  --source . `
  --project spatialguard `
  --region us-central1 `
  --platform managed `
  --allow-unauthenticated `
  --port 8080 `
  --set-env-vars "$envVars" `
  --quiet
