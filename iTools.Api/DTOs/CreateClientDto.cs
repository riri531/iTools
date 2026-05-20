using Microsoft.AspNetCore.Http;

namespace iTools.Api.DTOs;

public class CreateClientDto
{
    public string NomClient { get; set; } = string.Empty;

    public string NomFamille { get; set; } = string.Empty;

    public string NomReference { get; set; } = string.Empty;

    public DateTime? CreatedAt { get; set; }

    public string? ImageUrl { get; set; }

    public IFormFile? Image { get; set; }
}