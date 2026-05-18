namespace iTools.Api.Models;

public class ReclamationHistory
{
    public int Id { get; set; }

    public int ReclamationId { get; set; }

    public Reclamation? Reclamation { get; set; }

    public int ActionByUserId { get; set; }

    public User? ActionByUser { get; set; }

    public string Action { get; set; } = string.Empty;

    public string OldStatus { get; set; } = string.Empty;

    public string NewStatus { get; set; } = string.Empty;

    public string Comment { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.Now;
}