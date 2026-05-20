namespace iTools.Api.Models;

public class Ligne
{
    public int Id { get; set; }

    public string Nom { get; set; } = string.Empty;

    public string Nomenclature { get; set; } = "Générale";

    public string? ImageUrl { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}