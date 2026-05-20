using Microsoft.AspNetCore.Http;

namespace iTools.Api.DTOs;

public class UpdateLigneDto
{
    public string Nom { get; set; } = string.Empty;

    public string Nomenclature { get; set; } = "Générale";

    public DateTime? CreatedAt { get; set; }

    public IFormFile? Image { get; set; }

    public bool RemoveImage { get; set; }
}