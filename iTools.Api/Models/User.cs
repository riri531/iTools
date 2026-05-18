namespace iTools.Api.Models;

public class User
{
    public int Id { get; set; }

    public string FullName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public string? PhoneNumber { get; set; }

    public string? Address { get; set; }

    public string? ProfilePhotoUrl { get; set; }

    public int RoleId { get; set; }

    public Role? Role { get; set; }
}