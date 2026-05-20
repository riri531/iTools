namespace iTools.Api.Models;

public class Matiere
{
    public int Id { get; set; }

    public string NomMatiere { get; set; } = string.Empty;

    public string Process { get; set; } = string.Empty;

    public string? ImageUrl { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}