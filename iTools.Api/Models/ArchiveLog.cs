using System;

namespace iTools.Api.Models
{
    public class ArchiveLog
    {
        public int Id { get; set; }

        public int? UserId { get; set; }

        public string UserName { get; set; } = string.Empty;

        public string Role { get; set; } = string.Empty;

        public string Action { get; set; } = string.Empty;

        public string EntityName { get; set; } = string.Empty;

        public int? EntityId { get; set; }

        public string Description { get; set; } = string.Empty;

        public string? OldValues { get; set; }

        public string? NewValues { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}