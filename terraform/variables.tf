variable "resource_group_name" {
  description = "Name of the Azure resource group"
  type        = string
  default     = "culvertsense-rg"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "uksouth"
}

variable "vm_name" {
  description = "Name of the virtual machine"
  type        = string
  default     = "culvertsense-vm"
}

variable "vm_size" {
  description = "Azure VM SKU"
  type        = string
  default     = "Standard_B2ms"
}

variable "admin_username" {
  description = "Local administrator username"
  type        = string
  default     = "culvertadmin"
}

variable "admin_ssh_public_key" {
  description = "SSH public key for the admin user"
  type        = string
  # Pass via TF_VAR_admin_ssh_public_key or a tfvars file — never commit the key.
}

variable "my_ip_cidr" {
  description = "Your egress IP in CIDR notation, used to restrict SSH access (e.g. '203.0.113.10/32' or '2001:db8::1/128')"
  type        = string
  # Pass via TF_VAR_my_ip_cidr or a tfvars file.
}

variable "my_ip_cidr_v4" {
  description = "Legacy IPv4 egress IP in CIDR notation — kept as a fallback SSH rule while IPv6 connectivity is confirmed"
  type        = string
  default     = ""
  # Set to empty string to disable. Pass via TF_VAR_my_ip_cidr_v4 or a tfvars file.
}

variable "gateway_ip_cidr" {
  description = "Egress IP of the RAK gateway (home network) in CIDR notation — used to allow Basics Station WebSocket on port 3001"
  type        = string
  # Pass via TF_VAR_gateway_ip_cidr or a tfvars file. Use /128 for a single IPv6 host or widen to /56 if the gateway source IP varies.
}

variable "data_disk_size_gb" {
  description = "Size of the attached managed data disk in GiB"
  type        = number
  default     = 64
}

variable "os_disk_size_gb" {
  description = "Size of the OS disk in GiB"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Tags applied to all resources"
  type        = map(string)
  default = {
    project     = "culvertsense"
    environment = "production"
    managed_by  = "terraform"
  }
}
