# ChirpStack v4 configuration
# Full reference: https://www.chirpstack.io/docs/chirpstack/configuration.html
# Values that contain secrets should be injected via environment variables
# (see docker-compose.yml environment: block).

[logging]
  level = "info"

[postgresql]
  # Overridden by POSTGRESQL__DSN env var in docker-compose.yml
  dsn = "postgres://chirpstack:__POSTGRES_PASSWORD__@postgres/chirpstack?sslmode=disable"
  max_open_connections = 10
  min_idle_connections = 0

[redis]
  # Overridden by REDIS__SERVER env var in docker-compose.yml
  servers = ["redis://redis:6379"]
  cluster = false

[network]
  net_id = "000000"
  # Add enabled region config files under config/chirpstack/regions/
  enabled_regions = ["eu868"]

[api]
  bind = "0.0.0.0:8080"
  secret = "__CHIRPSTACK_SECRET__"

[gateway]
  # CA cert for gateway-to-server mTLS (optional)
  # ca_cert = "/etc/chirpstack/certs/ca.pem"
  client_cert_lifetime = "11months 30days 3h 50m 7s"

# Gateway MQTT backend is configured per-region in region_eu868.toml

[integration]
  enabled = ["mqtt"]

  [integration.mqtt]
    server      = "tcp://mosquitto:1883"
    event_topic = "application/{{application_id}}/device/{{dev_eui}}/event/{{event}}"

[monitoring]
  bind = "0.0.0.0:8070"
