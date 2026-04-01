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
