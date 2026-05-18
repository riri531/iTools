namespace iTools.Api.Models;

public class UserNotification
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public User? User { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    public string Type { get; set; } = "INFO";

    public bool IsRead { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.Now;
}