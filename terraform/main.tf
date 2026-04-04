###############################################################################
# Current Azure client (needed for Key Vault access policy / RBAC)
###############################################################################
data "azurerm_client_config" "current" {}

###############################################################################
# Resource group
###############################################################################
resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
  tags     = var.tags
}

###############################################################################
# Networking
###############################################################################
resource "azurerm_virtual_network" "main" {
  name                = "${var.vm_name}-vnet"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  address_space       = ["10.0.0.0/16"]
  tags                = var.tags
}

resource "azurerm_subnet" "main" {
  name                 = "${var.vm_name}-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.0.1.0/24"]
}

###############################################################################
# Network Security Group
###############################################################################
resource "azurerm_network_security_group" "main" {
  name                = "${var.vm_name}-nsg"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = var.tags

  # SSH — restricted to the operator's IP only
  security_rule {
    name                       = "allow-ssh"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = var.my_ip_cidr
    destination_address_prefix = "*"
  }

  # SSH fallback — legacy IPv4 address kept until IPv6 SSH is confirmed working
  security_rule {
    name                        = "allow-ssh-v4-fallback"
    priority                    = 101
    direction                   = "Inbound"
    access                      = "Allow"
    protocol                    = "Tcp"
    source_port_range           = "*"
    destination_port_range      = "22"
    source_address_prefixes     = var.my_ip_cidr_v4
    destination_address_prefix  = "*"
  }

  # HTTPS — public
  security_rule {
    name                       = "allow-https"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  # ChirpStack gRPC API — restricted to operator IP only (never expose publicly)
  security_rule {
    name                       = "allow-app-api"
    priority                   = 120
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "3001"
    source_address_prefix      = var.my_ip_cidr
    destination_address_prefix = "*"
  }

  # ChirpStack Basics Station WebSocket — RAK gateway inbound on port 3001 (IPv6)
  security_rule {
    name                       = "allow-basics-station"
    priority                   = 125
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "3001"
    source_address_prefix      = var.gateway_ip_cidr
    destination_address_prefix = "*"
  }

  # ChirpStack Basics Station WebSocket — RAK gateway inbound on port 3001 (IPv4 fallback)
  security_rule {
    name                        = "allow-basics-station-v4"
    priority                    = 126
    direction                   = "Inbound"
    access                      = "Allow"
    protocol                    = "Tcp"
    source_port_range           = "*"
    destination_port_range      = "3001"
    source_address_prefixes     = var.my_ip_cidr_v4
    destination_address_prefix  = "*"
  }

  # ChirpStack web UI — restricted to operator IP only
  security_rule {
    name                       = "allow-chirpstack-ui"
    priority                   = 130
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "8443"
    source_address_prefix      = var.my_ip_cidr
    destination_address_prefix = "*"
  }

  # ChirpStack web UI fallback — legacy IPv4 address kept until IPv6 is confirmed working
  security_rule {
    name                        = "allow-chirpstack-ui-v4-fallback"
    priority                    = 131
    direction                   = "Inbound"
    access                      = "Allow"
    protocol                    = "Tcp"
    source_port_range           = "*"
    destination_port_range      = "8443"
    source_address_prefixes     = var.my_ip_cidr_v4
    destination_address_prefix  = "*"
  }

  # Deny all other inbound traffic (Azure default deny sits at 65500, but
  # an explicit rule makes the intent visible in audit logs)
  security_rule {
    name                       = "deny-all-inbound"
    priority                   = 4000
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}

resource "azurerm_subnet_network_security_group_association" "main" {
  subnet_id                 = azurerm_subnet.main.id
  network_security_group_id = azurerm_network_security_group.main.id
}

###############################################################################
# Static public IP
###############################################################################
resource "azurerm_public_ip" "main" {
  name                = "${var.vm_name}-pip"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = var.tags
}

###############################################################################
# Network interface
###############################################################################
resource "azurerm_network_interface" "main" {
  name                = "${var.vm_name}-nic"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = var.tags

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.main.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.main.id
  }
}

resource "azurerm_network_interface_security_group_association" "main" {
  network_interface_id      = azurerm_network_interface.main.id
  network_security_group_id = azurerm_network_security_group.main.id
}

###############################################################################
# Virtual machine
###############################################################################
resource "azurerm_linux_virtual_machine" "main" {
  name                            = var.vm_name
  location                        = azurerm_resource_group.main.location
  resource_group_name             = azurerm_resource_group.main.name
  size                            = var.vm_size
  admin_username                  = var.admin_username
  disable_password_authentication = true
  tags                            = var.tags

  network_interface_ids = [
    azurerm_network_interface.main.id,
  ]

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.vm.id]
  }

  admin_ssh_key {
    username   = var.admin_username
    public_key = var.admin_ssh_public_key
  }

  os_disk {
    name                 = "${var.vm_name}-osdisk"
    caching              = "ReadWrite"
    storage_account_type = "Premium_LRS"
    disk_size_gb         = var.os_disk_size_gb
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }

  # Boot diagnostics enable the serial console in the Azure portal — useful
  # for recovering a misconfigured network without an SSH fallback.
  boot_diagnostics {}
}

###############################################################################
# Managed data disk
###############################################################################
resource "azurerm_managed_disk" "data" {
  name                 = "${var.vm_name}-datadisk"
  location             = azurerm_resource_group.main.location
  resource_group_name  = azurerm_resource_group.main.name
  storage_account_type = "Premium_LRS"
  create_option        = "Empty"
  disk_size_gb         = var.data_disk_size_gb
  tags                 = var.tags
}

resource "azurerm_virtual_machine_data_disk_attachment" "data" {
  managed_disk_id    = azurerm_managed_disk.data.id
  virtual_machine_id = azurerm_linux_virtual_machine.main.id
  lun                = 0
  caching            = "ReadWrite"
}

###############################################################################
# User-assigned managed identity for the VM
# (Preferred over system-assigned so principal_id is resolvable at plan time)
###############################################################################
resource "azurerm_user_assigned_identity" "vm" {
  name                = "${var.vm_name}-identity"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = var.tags
}

###############################################################################
# Key Vault
###############################################################################
resource "azurerm_key_vault" "main" {
  name                        = "${var.vm_name}-kv"
  location                    = azurerm_resource_group.main.location
  resource_group_name         = azurerm_resource_group.main.name
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  sku_name                    = "standard"
  soft_delete_retention_days  = 7
  purge_protection_enabled    = false
  enable_rbac_authorization   = true
  tags                        = var.tags
}

# Allow the operator (Terraform runner) to manage secrets
resource "azurerm_role_assignment" "kv_operator_admin" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Administrator"
  principal_id         = data.azurerm_client_config.current.object_id
}

# Allow the VM's managed identity to read secrets
# time_sleep gives RBAC a moment to propagate before we create secrets
resource "time_sleep" "rbac_propagation" {
  depends_on      = [azurerm_role_assignment.kv_operator_admin]
  create_duration = "30s"
}

resource "azurerm_role_assignment" "kv_vm_secrets_user" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.vm.principal_id
}

###############################################################################
# Storage Account — culvert map static assets (GeoJSON + HTML)
###############################################################################
resource "azurerm_storage_account" "map" {
  name                     = "culvertsensemap"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"

  # Serve files directly over HTTPS without needing a CDN
  static_website {
    index_document = "culvert_map.html"
  }

  blob_properties {
    cors_rule {
      allowed_headers    = ["*"]
      allowed_methods    = ["GET", "HEAD"]
      allowed_origins    = ["https://culvertsense.com", "http://localhost:8765", "http://localhost:3000", "http://127.0.0.1:8765"]
      exposed_headers    = ["*"]
      max_age_in_seconds = 3600
    }
  }

  tags = var.tags
}

resource "azurerm_storage_container" "map" {
  name                  = "map"
  storage_account_name  = azurerm_storage_account.map.name
  container_access_type = "blob"   # public read, no list
}

###############################################################################
# Generated secrets
###############################################################################
resource "random_password" "postgres" {
  length           = 32
  special          = false
}

resource "random_password" "chirpstack_api_secret" {
  length           = 44
  special          = true
  override_special = "+/="
}

resource "random_password" "influxdb_admin_password" {
  length  = 32
  special = false
}

resource "random_password" "influxdb_admin_token" {
  length  = 64
  special = false
}

###############################################################################
# Key Vault secrets
###############################################################################
resource "azurerm_key_vault_secret" "postgres_password" {
  name         = "postgres-password"
  value        = random_password.postgres.result
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [time_sleep.rbac_propagation]
}

resource "azurerm_key_vault_secret" "chirpstack_api_secret" {
  name         = "chirpstack-api-secret"
  value        = random_password.chirpstack_api_secret.result
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [time_sleep.rbac_propagation]
}

resource "azurerm_key_vault_secret" "influxdb_admin_password" {
  name         = "influxdb-admin-password"
  value        = random_password.influxdb_admin_password.result
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [time_sleep.rbac_propagation]
}

resource "azurerm_key_vault_secret" "influxdb_admin_token" {
  name         = "influxdb-admin-token"
  value        = random_password.influxdb_admin_token.result
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [time_sleep.rbac_propagation]
}
