namespace iTools.Api.DTOs;

public class MatiereDto
{
    public int Id { get; set; }

    public string NomMatiere { get; set; } = string.Empty;

    public string Process { get; set; } = string.Empty;

    public string? ImageUrl { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}