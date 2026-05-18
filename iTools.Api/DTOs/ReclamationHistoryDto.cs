namespace iTools.Api.DTOs;

public class ReclamationHistoryDto
{
    public int Id { get; set; }

    public int ReclamationId { get; set; }

    public int ActionByUserId { get; set; }

    public string ActionByUserName { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public string OldStatus { get; set; } = string.Empty;

    public string NewStatus { get; set; } = string.Empty;

    public string Comment { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}