output "public_ip_address" {
  description = "Static public IP address of the VM"
  value       = azurerm_public_ip.main.ip_address
}

output "vm_id" {
  description = "Azure resource ID of the virtual machine"
  value       = azurerm_linux_virtual_machine.main.id
}

output "ssh_connection_string" {
  description = "SSH command to connect to the VM"
  value       = "ssh ${var.admin_username}@${azurerm_public_ip.main.ip_address}"
}

output "data_disk_id" {
  description = "Azure resource ID of the attached managed data disk"
  value       = azurerm_managed_disk.data.id
}

output "key_vault_uri" {
  description = "URI of the Key Vault (used by load-secrets.sh)"
  value       = azurerm_key_vault.main.vault_uri
}

output "key_vault_name" {
  description = "Name of the Key Vault"
  value       = azurerm_key_vault.main.name
}

output "map_storage_account_name" {
  description = "Storage account name for the culvert map"
  value       = azurerm_storage_account.map.name
}

output "map_url" {
  description = "Public URL of the culvert map (static website endpoint)"
  value       = "${azurerm_storage_account.map.primary_web_endpoint}culvert_map.html"
}

output "map_upload_command" {
  description = "az CLI command to upload/update the map files"
  value       = <<-EOT
    az storage blob upload-batch \
      --account-name ${azurerm_storage_account.map.name} \
      --destination '$web' \
      --source culvert_map/output \
      --pattern "culvert_map.html" \
      --overwrite

    az storage blob upload-batch \
      --account-name ${azurerm_storage_account.map.name} \
      --destination '$web' \
      --source culvert_map/output \
      --pattern "culvert_crossings.geojson" \
      --content-type "application/geo+json" \
      --overwrite
  EOT
}
