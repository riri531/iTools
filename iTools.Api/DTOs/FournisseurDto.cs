namespace iTools.Api.DTOs;

public class FournisseurDto
{
    public int Id { get; set; }

    public string CodeFournisseur { get; set; } = string.Empty;

    public string NomFournisseur { get; set; } = string.Empty;

    public string? Nomenclature { get; set; }

    public string? ImageUrl { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}