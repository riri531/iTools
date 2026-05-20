using Microsoft.AspNetCore.Http;

namespace iTools.Api.DTOs;

public class UpdateUserDto
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Password { get; set; }
    public int RoleId { get; set; }
    public DateTime? CreatedAt { get; set; }
    public IFormFile? Image { get; set; }
    public bool RemoveImage { get; set; }
}