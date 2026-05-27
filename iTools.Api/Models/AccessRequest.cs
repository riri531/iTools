namespace iTools.Api.Models;

public class AccessRequest
{
    public int Id { get; set; }

    public string FullName { get; set; } = string.Empty;

    public string Matricule { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string PhoneNumber { get; set; } = string.Empty;

    public string Department { get; set; } = string.Empty;

    public string? Message { get; set; }

    public string Status { get; set; } = "EN_ATTENTE";

    public string? DecisionComment { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? TreatedAt { get; set; }

    public int? TreatedByUserId { get; set; }

    public User? TreatedByUser { get; set; }
}