namespace iTools.Api.Models;

public class Emplacement
{
    public int Id { get; set; }

    public int MatiereId { get; set; }
    public Matiere? Matiere { get; set; }

    public string Armoire { get; set; } = string.Empty;
    public string Numero { get; set; } = string.Empty;

    public int DesignationId { get; set; }
    public Designation? Designation { get; set; }

    public string Status { get; set; } = "LIBRE";

    public string? ImageUrl { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}