using System.Security.Claims;
using System.Text.Json;
using iTools.Api.Data;
using iTools.Api.Models;

namespace iTools.Api.Services
{
    public class ArchiveService
    {
        private readonly ApplicationDbContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public ArchiveService(
            ApplicationDbContext context,
            IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task AddAsync(
            string action,
            string entityName,
            int? entityId,
            string description,
            object? oldValues = null,
            object? newValues = null)
        {
            var user = _httpContextAccessor.HttpContext?.User;

            var userIdValue =
                user?.FindFirst(ClaimTypes.NameIdentifier)?.Value ??
                user?.FindFirst("sub")?.Value ??
                user?.FindFirst("id")?.Value;

            int? userId = null;

            if (int.TryParse(userIdValue, out var parsedUserId))
            {
                userId = parsedUserId;
            }

            var userName =
                user?.FindFirst(ClaimTypes.Name)?.Value ??
                user?.FindFirst("FullName")?.Value ??
                user?.FindFirst("name")?.Value ??
                user?.FindFirst(ClaimTypes.Email)?.Value ??
                "Utilisateur inconnu";

            var role =
                user?.FindFirst(ClaimTypes.Role)?.Value ??
                user?.FindFirst("role")?.Value ??
                "Role inconnu";

            var archive = new ArchiveLog
            {
                UserId = userId,
                UserName = userName,
                Role = role,
                Action = action,
                EntityName = entityName,
                EntityId = entityId,
                Description = description,
                OldValues = oldValues == null ? null : Serialize(oldValues),
                NewValues = newValues == null ? null : Serialize(newValues),
                CreatedAt = DateTime.Now
            };

            _context.ArchiveLogs.Add(archive);
            await _context.SaveChangesAsync();
        }

        private static string Serialize(object value)
        {
            return JsonSerializer.Serialize(value, new JsonSerializerOptions
            {
                WriteIndented = false
            });
        }
    }
}