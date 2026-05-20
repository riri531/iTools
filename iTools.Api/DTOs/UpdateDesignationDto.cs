using Microsoft.AspNetCore.Http;

namespace iTools.Api.DTOs;

public class UpdateDesignationDto
{
    public string Name { get; set; } = string.Empty;

    public string Type { get; set; } = "Général";

    public DateTime? CreatedAt { get; set; }

    public IFormFile? Image { get; set; }

    public bool RemoveImage { get; set; }
}