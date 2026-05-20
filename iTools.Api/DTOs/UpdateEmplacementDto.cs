using Microsoft.AspNetCore.Http;

namespace iTools.Api.DTOs;

public class UpdateEmplacementDto
{
    public int MatiereId { get; set; }
    public string Armoire { get; set; } = string.Empty;
    public string Numero { get; set; } = string.Empty;
    public int DesignationId { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? CreatedAt { get; set; }
    public IFormFile? Image { get; set; }
    public bool RemoveImage { get; set; }
}