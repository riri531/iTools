using Microsoft.AspNetCore.Http;

namespace iTools.Api.DTOs;

public class UpdateMatiereDto
{
    public string NomMatiere { get; set; } = string.Empty;

    public string Process { get; set; } = string.Empty;

    public DateTime? CreatedAt { get; set; }

    public IFormFile? Image { get; set; }

    public bool RemoveImage { get; set; }
}