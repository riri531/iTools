using System.Security.Claims;
using iTools.Api.Data;
using iTools.Api.DTOs;
using iTools.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iTools.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReclamationsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public ReclamationsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [Authorize(Roles = "ADMIN,RESPONSABLE,EMPLOYE")]
    public async Task<ActionResult<IEnumerable<ReclamationDto>>> GetAll()
    {
        var currentUserId = GetCurrentUserId();
        var currentRole = GetCurrentUserRole();

        if (currentUserId == null)
            return Unauthorized("Utilisateur non authentifié.");

        var query = _context.Reclamations
            .Include(r => r.CreatedByUser)
                .ThenInclude(u => u!.Role)
            .Include(r => r.AssignedToUser)
            .Include(r => r.TreatedByUser)
            .Include(r => r.Histories)
                .ThenInclude(h => h.ActionByUser)
            .AsQueryable();

        if (currentRole == "ADMIN")
        {
            query = query.Where(r =>
                r.AssignedToRole == "ADMIN");
        }
        else if (currentRole == "RESPONSABLE")
        {
            query = query.Where(r =>
                r.AssignedToRole == "RESPONSABLE" ||
                r.CreatedByUserId == currentUserId.Value);
        }
        else
        {
            query = query.Where(r =>
                r.CreatedByUserId == currentUserId.Value);
        }

        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => ToDto(r))
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("mine")]
    [Authorize(Roles = "RESPONSABLE,EMPLOYE")]
    public async Task<ActionResult<IEnumerable<ReclamationDto>>> GetMine()
    {
        var currentUserId = GetCurrentUserId();

        if (currentUserId == null)
            return Unauthorized("Utilisateur non authentifié.");

        var items = await _context.Reclamations
            .Include(r => r.CreatedByUser)
                .ThenInclude(u => u!.Role)
            .Include(r => r.AssignedToUser)
            .Include(r => r.TreatedByUser)
            .Include(r => r.Histories)
                .ThenInclude(h => h.ActionByUser)
            .Where(r => r.CreatedByUserId == currentUserId.Value)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => ToDto(r))
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("assigned")]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    public async Task<ActionResult<IEnumerable<ReclamationDto>>> GetAssignedToMeOrRole()
    {
        var currentUserId = GetCurrentUserId();
        var currentRole = GetCurrentUserRole();

        if (currentUserId == null)
            return Unauthorized("Utilisateur non authentifié.");

        var items = await _context.Reclamations
            .Include(r => r.CreatedByUser)
                .ThenInclude(u => u!.Role)
            .Include(r => r.AssignedToUser)
            .Include(r => r.TreatedByUser)
            .Include(r => r.Histories)
                .ThenInclude(h => h.ActionByUser)
            .Where(r =>
                r.AssignedToRole == currentRole ||
                r.AssignedToUserId == currentUserId.Value)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => ToDto(r))
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id}")]
    [Authorize(Roles = "ADMIN,RESPONSABLE,EMPLOYE")]
    public async Task<ActionResult<ReclamationDto>> GetById(int id)
    {
        var currentUserId = GetCurrentUserId();
        var currentRole = GetCurrentUserRole();

        if (currentUserId == null)
            return Unauthorized("Utilisateur non authentifié.");

        var item = await _context.Reclamations
            .Include(r => r.CreatedByUser)
                .ThenInclude(u => u!.Role)
            .Include(r => r.AssignedToUser)
            .Include(r => r.TreatedByUser)
            .Include(r => r.Histories)
                .ThenInclude(h => h.ActionByUser)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (item == null)
            return NotFound("Réclamation introuvable.");

        if (!CanAccessReclamation(item, currentUserId.Value, currentRole))
            return Forbid();

        return Ok(ToDto(item));
    }

    [HttpPost]
    [Authorize(Roles = "RESPONSABLE,EMPLOYE")]
    public async Task<ActionResult<ReclamationDto>> Create(CreateReclamationDto dto)
    {
        var currentUserId = GetCurrentUserId();

        if (currentUserId == null)
            return Unauthorized("Utilisateur non authentifié.");

        if (string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest("Le titre de la réclamation est obligatoire.");

        if (string.IsNullOrWhiteSpace(dto.ProblemType))
            return BadRequest("Le type de problème est obligatoire.");

        if (string.IsNullOrWhiteSpace(dto.Description))
            return BadRequest("La description est obligatoire.");

        if (string.IsNullOrWhiteSpace(dto.SourcePage))
            return BadRequest("La page source est obligatoire.");

        if (string.IsNullOrWhiteSpace(dto.EntityName))
            return BadRequest("L’entité concernée est obligatoire.");

        var creator = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value);

        if (creator == null)
            return NotFound("Utilisateur introuvable.");

        var creatorRole = creator.Role != null ? creator.Role.Name : "";

        if (creatorRole == "ADMIN")
            return Forbid();

        var assignedRole = creatorRole switch
        {
            "EMPLOYE" => "RESPONSABLE",
            "RESPONSABLE" => "ADMIN",
            _ => "RESPONSABLE"
        };

        var item = new Reclamation
        {
            Title = dto.Title.Trim(),
            ProblemType = dto.ProblemType.Trim(),
            Description = dto.Description.Trim(),
            ReclamationDate = dto.ReclamationDate ?? DateTime.Now,
            SourcePage = dto.SourcePage.Trim(),
            EntityName = dto.EntityName.Trim(),
            EntityId = dto.EntityId,
            EntityLabel = dto.EntityLabel?.Trim() ?? "",
            Status = "EN_ATTENTE",
            Priority = string.IsNullOrWhiteSpace(dto.Priority) ? "NORMALE" : dto.Priority.Trim(),
            AssignedToRole = assignedRole,
            CreatedByUserId = creator.Id,
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };

        _context.Reclamations.Add(item);
        await _context.SaveChangesAsync();

        await AddHistoryAsync(
            item.Id,
            creator.Id,
            "CREATE",
            "",
            item.Status,
            $"Création de la réclamation : {item.Title}"
        );

        await AddArchiveAsync(
            creator,
            action: "CREATE_RECLAMATION",
            entityId: item.Id,
            description: $"Création d’une réclamation : {item.Title}",
            oldValues: null,
            newValues: new
            {
                item.Id,
                item.Title,
                item.ProblemType,
                item.Description,
                item.SourcePage,
                item.EntityName,
                item.EntityId,
                item.EntityLabel,
                item.Status,
                item.Priority,
                item.AssignedToRole
            }
        );

        await NotifyRoleAsync(
            assignedRole,
            title: "Nouvelle réclamation",
            message: $"{creator.FullName} a créé une réclamation : {item.Title}",
            type: "RECLAMATION"
        );

        await NotifyUserAsync(
            creator.Id,
            title: "Réclamation envoyée",
            message: $"Votre réclamation « {item.Title} » a été envoyée au rôle {assignedRole}.",
            type: "RECLAMATION"
        );

        var createdItem = await GetFullReclamation(item.Id);

        return CreatedAtAction(nameof(GetById), new { id = item.Id }, ToDto(createdItem!));
    }

    [HttpPut("{id}/start")]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    public async Task<IActionResult> StartTreatment(int id, StartReclamationDto dto)
    {
        var currentUserId = GetCurrentUserId();
        var currentRole = GetCurrentUserRole();

        if (currentUserId == null)
            return Unauthorized("Utilisateur non authentifié.");

        var user = await GetCurrentUser();

        if (user == null)
            return NotFound("Utilisateur introuvable.");

        var item = await _context.Reclamations
            .Include(r => r.CreatedByUser)
                .ThenInclude(u => u!.Role)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (item == null)
            return NotFound("Réclamation introuvable.");

        if (!CanTreatReclamation(item, currentUserId.Value, currentRole))
            return Forbid();

        var oldStatus = item.Status;

        item.Status = "EN_COURS";
        item.AssignedToUserId = currentUserId.Value;
        item.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        await AddHistoryAsync(
            item.Id,
            currentUserId.Value,
            "START_TREATMENT",
            oldStatus,
            item.Status,
            string.IsNullOrWhiteSpace(dto.Comment)
                ? "Traitement commencé."
                : dto.Comment.Trim()
        );

        await AddArchiveAsync(
            user,
            action: "START_RECLAMATION",
            entityId: item.Id,
            description: $"Début de traitement de la réclamation : {item.Title}",
            oldValues: new { Status = oldStatus },
            newValues: new
            {
                item.Status,
                item.AssignedToUserId
            }
        );

        await NotifyUserAsync(
            item.CreatedByUserId,
            title: "Réclamation en cours",
            message: $"Votre réclamation « {item.Title} » est en cours de traitement.",
            type: "RECLAMATION"
        );

        return NoContent();
    }

    [HttpPut("{id}/escalate")]
    [Authorize(Roles = "RESPONSABLE")]
    public async Task<IActionResult> EscalateToAdmin(int id, EscalateReclamationDto dto)
    {
        var currentUserId = GetCurrentUserId();
        var currentRole = GetCurrentUserRole();

        if (currentUserId == null)
            return Unauthorized("Utilisateur non authentifié.");

        var user = await GetCurrentUser();

        if (user == null)
            return NotFound("Utilisateur introuvable.");

        var item = await _context.Reclamations
            .Include(r => r.CreatedByUser)
                .ThenInclude(u => u!.Role)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (item == null)
            return NotFound("Réclamation introuvable.");

        if (!CanTreatReclamation(item, currentUserId.Value, currentRole))
            return Forbid();

        if (string.IsNullOrWhiteSpace(dto.Reason))
            return BadRequest("La raison de l’escalade est obligatoire.");

        var oldStatus = item.Status;

        item.Status = "ESCALADEE_ADMIN";
        item.AssignedToRole = "ADMIN";
        item.AssignedToUserId = null;
        item.Priority = string.IsNullOrWhiteSpace(dto.Priority) ? "HAUTE" : dto.Priority.Trim();
        item.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        await AddHistoryAsync(
            item.Id,
            currentUserId.Value,
            "ESCALATE_TO_ADMIN",
            oldStatus,
            item.Status,
            dto.Reason.Trim()
        );

        await AddArchiveAsync(
            user,
            action: "ESCALATE_RECLAMATION",
            entityId: item.Id,
            description: $"Réclamation escaladée vers ADMIN : {item.Title}",
            oldValues: new { Status = oldStatus },
            newValues: new
            {
                item.Status,
                item.AssignedToRole,
                item.Priority,
                Reason = dto.Reason
            }
        );

        await NotifyRoleAsync(
            "ADMIN",
            title: "Réclamation escaladée",
            message: $"Une réclamation a été escaladée vers les admins : {item.Title}",
            type: "RECLAMATION"
        );

        await NotifyUserAsync(
            item.CreatedByUserId,
            title: "Réclamation escaladée",
            message: $"Votre réclamation « {item.Title} » a été transmise aux admins.",
            type: "RECLAMATION"
        );

        return NoContent();
    }

    [HttpPut("{id}/treat")]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    public async Task<IActionResult> Treat(int id, TreatReclamationDto dto)
    {
        var currentUserId = GetCurrentUserId();
        var currentRole = GetCurrentUserRole();

        if (currentUserId == null)
            return Unauthorized("Utilisateur non authentifié.");

        var user = await GetCurrentUser();

        if (user == null)
            return NotFound("Utilisateur introuvable.");

        var item = await _context.Reclamations
            .Include(r => r.CreatedByUser)
                .ThenInclude(u => u!.Role)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (item == null)
            return NotFound("Réclamation introuvable.");

        if (!CanTreatReclamation(item, currentUserId.Value, currentRole))
            return Forbid();

        if (string.IsNullOrWhiteSpace(dto.Decision))
            return BadRequest("La décision est obligatoire.");

        if (string.IsNullOrWhiteSpace(dto.Resolution))
            return BadRequest("La résolution ou l’opération effectuée est obligatoire.");

        var allowedStatuses = new[] { "TRAITEE", "REFUSEE", "CLOTUREE" };
        var newStatus = string.IsNullOrWhiteSpace(dto.Status)
            ? "TRAITEE"
            : dto.Status.Trim();

        if (!allowedStatuses.Contains(newStatus))
            return BadRequest("Statut invalide. Valeurs acceptées : TRAITEE, REFUSEE, CLOTUREE.");

        var oldStatus = item.Status;

        item.Status = newStatus;
        item.Decision = dto.Decision.Trim();
        item.Resolution = dto.Resolution.Trim();
        item.TreatedByUserId = currentUserId.Value;
        item.TreatedAt = DateTime.Now;
        item.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        await AddHistoryAsync(
            item.Id,
            currentUserId.Value,
            "TREAT",
            oldStatus,
            item.Status,
            $"Décision : {item.Decision}. Résolution : {item.Resolution}"
        );

        await AddArchiveAsync(
            user,
            action: "TREAT_RECLAMATION",
            entityId: item.Id,
            description: $"Traitement de la réclamation : {item.Title}",
            oldValues: new { Status = oldStatus },
            newValues: new
            {
                item.Status,
                item.Decision,
                item.Resolution,
                item.TreatedByUserId,
                item.TreatedAt
            }
        );

        await NotifyUserAsync(
            item.CreatedByUserId,
            title: "Réclamation traitée",
            message: $"Votre réclamation « {item.Title} » a été traitée. Décision : {item.Decision}",
            type: "RECLAMATION"
        );

        return NoContent();
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> Delete(int id)
    {
        var currentUser = await GetCurrentUser();

        if (currentUser == null)
            return Unauthorized("Utilisateur non authentifié.");

        var item = await _context.Reclamations
            .Include(r => r.Histories)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (item == null)
            return NotFound("Réclamation introuvable.");

        var oldValues = new
        {
            item.Id,
            item.Title,
            item.ProblemType,
            item.Description,
            item.SourcePage,
            item.EntityName,
            item.EntityId,
            item.EntityLabel,
            item.Status,
            item.Priority,
            item.AssignedToRole,
            item.CreatedByUserId
        };

        _context.Reclamations.Remove(item);
        await _context.SaveChangesAsync();

        await AddArchiveAsync(
            currentUser,
            action: "DELETE_RECLAMATION",
            entityId: id,
            description: $"Suppression de la réclamation : {oldValues.Title}",
            oldValues: oldValues,
            newValues: null
        );

        return NoContent();
    }

    private async Task<Reclamation?> GetFullReclamation(int id)
    {
        return await _context.Reclamations
            .Include(r => r.CreatedByUser)
                .ThenInclude(u => u!.Role)
            .Include(r => r.AssignedToUser)
            .Include(r => r.TreatedByUser)
            .Include(r => r.Histories)
                .ThenInclude(h => h.ActionByUser)
            .FirstOrDefaultAsync(r => r.Id == id);
    }

    private static ReclamationDto ToDto(Reclamation r)
    {
        return new ReclamationDto
        {
            Id = r.Id,
            Title = r.Title,
            ProblemType = r.ProblemType,
            Description = r.Description,
            ReclamationDate = r.ReclamationDate,
            SourcePage = r.SourcePage,
            EntityName = r.EntityName,
            EntityId = r.EntityId,
            EntityLabel = r.EntityLabel,
            Status = r.Status,
            Priority = r.Priority,
            AssignedToRole = r.AssignedToRole,
            AssignedToUserId = r.AssignedToUserId,
            AssignedToUserName = r.AssignedToUser != null ? r.AssignedToUser.FullName : "",
            CreatedByUserId = r.CreatedByUserId,
            CreatedByUserName = r.CreatedByUser != null ? r.CreatedByUser.FullName : "",
            CreatedByUserRole = r.CreatedByUser?.Role != null ? r.CreatedByUser.Role.Name : "",
            Decision = r.Decision,
            Resolution = r.Resolution,
            TreatedAt = r.TreatedAt,
            TreatedByUserId = r.TreatedByUserId,
            TreatedByUserName = r.TreatedByUser != null ? r.TreatedByUser.FullName : "",
            CreatedAt = r.CreatedAt,
            UpdatedAt = r.UpdatedAt,
            Histories = r.Histories
                .OrderByDescending(h => h.CreatedAt)
                .Select(h => new ReclamationHistoryDto
                {
                    Id = h.Id,
                    ReclamationId = h.ReclamationId,
                    ActionByUserId = h.ActionByUserId,
                    ActionByUserName = h.ActionByUser != null ? h.ActionByUser.FullName : "",
                    Action = h.Action,
                    OldStatus = h.OldStatus,
                    NewStatus = h.NewStatus,
                    Comment = h.Comment,
                    CreatedAt = h.CreatedAt
                })
                .ToList()
        };
    }

    private bool CanAccessReclamation(Reclamation item, int userId, string role)
    {
        if (item.CreatedByUserId == userId && role != "ADMIN")
            return true;

        if (role == "ADMIN")
            return item.AssignedToRole == "ADMIN";

        if (role == "RESPONSABLE")
            return item.AssignedToRole == "RESPONSABLE";

        return false;
    }

    private bool CanTreatReclamation(Reclamation item, int userId, string role)
    {
        if (item.Status == "TRAITEE" || item.Status == "REFUSEE" || item.Status == "CLOTUREE")
            return false;

        if (item.CreatedByUserId == userId)
            return false;

        if (role == "ADMIN")
            return item.AssignedToRole == "ADMIN";

        if (role == "RESPONSABLE")
            return item.AssignedToRole == "RESPONSABLE";

        return false;
    }

    private async Task AddHistoryAsync(
        int reclamationId,
        int actionByUserId,
        string action,
        string oldStatus,
        string newStatus,
        string comment)
    {
        var history = new ReclamationHistory
        {
            ReclamationId = reclamationId,
            ActionByUserId = actionByUserId,
            Action = action,
            OldStatus = oldStatus,
            NewStatus = newStatus,
            Comment = comment,
            CreatedAt = DateTime.Now
        };

        _context.ReclamationHistories.Add(history);
        await _context.SaveChangesAsync();
    }

    private async Task AddArchiveAsync(
        User user,
        string action,
        int? entityId,
        string description,
        object? oldValues,
        object? newValues)
    {
        var archive = new ArchiveLog
        {
            UserId = user.Id,
            UserName = user.FullName,
            Role = user.Role != null ? user.Role.Name : GetCurrentUserRole(),
            Action = action,
            EntityName = "Reclamation",
            EntityId = entityId,
            Description = description,
            OldValues = oldValues == null ? null : System.Text.Json.JsonSerializer.Serialize(oldValues),
            NewValues = newValues == null ? null : System.Text.Json.JsonSerializer.Serialize(newValues),
            CreatedAt = DateTime.Now
        };

        _context.ArchiveLogs.Add(archive);
        await _context.SaveChangesAsync();
    }

    private async Task NotifyUserAsync(int userId, string title, string message, string type)
    {
        var notification = new UserNotification
        {
            UserId = userId,
            Title = title,
            Message = message,
            Type = type,
            IsRead = false,
            CreatedAt = DateTime.Now
        };

        _context.UserNotifications.Add(notification);
        await _context.SaveChangesAsync();
    }

    private async Task NotifyRoleAsync(string roleName, string title, string message, string type)
    {
        var users = await _context.Users
            .Include(u => u.Role)
            .Where(u => u.Role != null && u.Role.Name == roleName)
            .ToListAsync();

        foreach (var user in users)
        {
            _context.UserNotifications.Add(new UserNotification
            {
                UserId = user.Id,
                Title = title,
                Message = message,
                Type = type,
                IsRead = false,
                CreatedAt = DateTime.Now
            });
        }

        await _context.SaveChangesAsync();
    }

    private async Task<User?> GetCurrentUser()
    {
        var userId = GetCurrentUserId();

        if (userId == null)
            return null;

        return await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId.Value);
    }

    private int? GetCurrentUserId()
    {
        var userIdValue = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (int.TryParse(userIdValue, out var userId))
            return userId;

        return null;
    }

    private string GetCurrentUserRole()
    {
        return User.FindFirst(ClaimTypes.Role)?.Value ?? "";
    }
}