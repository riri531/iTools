using Microsoft.AspNetCore.Http;

namespace iTools.Api.DTOs;

public class CreateFournisseurDto
{
    public string CodeFournisseur { get; set; } = string.Empty;

    public string NomFournisseur { get; set; } = string.Empty;

    public string? Nomenclature { get; set; }

    public DateTime? CreatedAt { get; set; }

    public IFormFile? Image { get; set; }
}