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

    private const string RoleAdmin = "ADMIN";
    private const string RoleResponsable = "RESPONSABLE";
    private const string RoleEmploye = "EMPLOYE";

    private const string StatusEnAttente = "EN_ATTENTE";
    private const string StatusEnCours = "EN_COURS";
    private const string StatusEscaladeeAdmin = "ESCALADEE_ADMIN";
    private const string StatusTraitee = "TRAITEE";
    private const string StatusRefusee = "REFUSEE";
    private const string StatusCloturee = "CLOTUREE";

    private const string ActionCreate = "CREATE";
    private const string ActionStartTreatment = "START_TREATMENT";
    private const string ActionEscalateToAdmin = "ESCALATE_TO_ADMIN";
    private const string ActionTreat = "TREAT";
    private const string ActionDelete = "DELETE";

    public ReclamationsController(ApplicationDbContext context)
    {
        _context = context;
    }

    // =========================================================
    // GET : réclamations visibles selon le rôle connecté
    // =========================================================

    [HttpGet]
    [Authorize(Roles = "ADMIN,RESPONSABLE,EMPLOYE,EMPLOYÉ")]
    public async Task<ActionResult<IEnumerable<ReclamationDto>>> GetAll()
    {
        var currentUserId = GetCurrentUserId();
        var currentRole = GetCurrentUserRole();

        if (currentUserId == null)
        {
            return Unauthorized("Utilisateur non authentifié.");
        }

        var query = _context.Reclamations
            .Include(r => r.CreatedByUser)
                .ThenInclude(u => u!.Role)
            .Include(r => r.AssignedToUser)
            .Include(r => r.TreatedByUser)
            .Include(r => r.Histories)
                .ThenInclude(h => h.ActionByUser)
            .AsQueryable();

        if (currentRole == RoleAdmin)
        {
            // ADMIN :
            // - ne voit pas les réclamations des employés encore chez le responsable.
            // - voit uniquement les réclamations créées par les responsables
            //   ou escaladées/transférées par un responsable.
            query = query.Where(r =>
                r.AssignedToRole == RoleAdmin &&
                (
                    r.CreatedByUser!.Role!.Name == RoleResponsable ||
                    r.Status == StatusEscaladeeAdmin ||
                    r.Histories.Any(h =>
                        h.Action == ActionEscalateToAdmin ||
                        h.NewStatus == StatusEscaladeeAdmin
                    )
                )
            );
        }
        else if (currentRole == RoleResponsable)
        {
            // RESPONSABLE :
            // - voit les réclamations des employés qui lui sont destinées.
            // - voit ses propres réclamations envoyées à l’admin pour suivi.
            query = query.Where(r =>
                (
                    r.AssignedToRole == RoleResponsable &&
                    r.CreatedByUser!.Role!.Name == RoleEmploye
                )
                ||
                r.CreatedByUserId == currentUserId.Value
            );
        }
        else if (currentRole == RoleEmploye)
        {
            // EMPLOYE :
            // - voit seulement ses propres réclamations.
            query = query.Where(r => r.CreatedByUserId == currentUserId.Value);
        }
        else
        {
            return Forbid();
        }

        var reclamations = await query
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        var items = reclamations
            .Select(ToDto)
            .ToList();

        return Ok(items);
    }

    [HttpGet("mine")]
    [Authorize(Roles = "ADMIN,RESPONSABLE,EMPLOYE,EMPLOYÉ")]
    public async Task<ActionResult<IEnumerable<ReclamationDto>>> GetMine()
    {
        var currentUserId = GetCurrentUserId();

        if (currentUserId == null)
        {
            return Unauthorized("Utilisateur non authentifié.");
        }

        var reclamations = await _context.Reclamations
            .Include(r => r.CreatedByUser)
                .ThenInclude(u => u!.Role)
            .Include(r => r.AssignedToUser)
            .Include(r => r.TreatedByUser)
            .Include(r => r.Histories)
                .ThenInclude(h => h.ActionByUser)
            .Where(r => r.CreatedByUserId == currentUserId.Value)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        var items = reclamations
            .Select(ToDto)
            .ToList();

        return Ok(items);
    }

    [HttpGet("{id:int}")]
    [Authorize(Roles = "ADMIN,RESPONSABLE,EMPLOYE,EMPLOYÉ")]
    public async Task<ActionResult<ReclamationDto>> GetById(int id)
    {
        var currentUserId = GetCurrentUserId();
        var currentRole = GetCurrentUserRole();

        if (currentUserId == null)
        {
            return Unauthorized("Utilisateur non authentifié.");
        }

        var reclamation = await _context.Reclamations
            .Include(r => r.CreatedByUser)
                .ThenInclude(u => u!.Role)
            .Include(r => r.AssignedToUser)
            .Include(r => r.TreatedByUser)
            .Include(r => r.Histories)
                .ThenInclude(h => h.ActionByUser)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (reclamation == null)
        {
            return NotFound("Réclamation introuvable.");
        }

        if (!CanView(reclamation, currentUserId.Value, currentRole))
        {
            return Forbid("Vous n'avez pas le droit de consulter cette réclamation.");
        }

        return Ok(ToDto(reclamation));
    }

    // =========================================================
    // POST : création réclamation
    // =========================================================

    [HttpPost]
    [Authorize(Roles = "RESPONSABLE,EMPLOYE,EMPLOYÉ")]
    public async Task<ActionResult<ReclamationDto>> Create(CreateReclamationDto dto)
    {
        var currentUserId = GetCurrentUserId();
        var currentRole = GetCurrentUserRole();

        if (currentUserId == null)
        {
            return Unauthorized("Utilisateur non authentifié.");
        }

        // RÈGLE MÉTIER PRINCIPALE :
        // L’ADMIN ne crée jamais de réclamation.
        // Il traite seulement les réclamations créées par les responsables
        // ou escaladées/transférées par les responsables.
        if (currentRole == RoleAdmin)
        {
            return Forbid("Un administrateur ne peut pas créer de réclamation. Il peut uniquement traiter les réclamations transférées par un responsable.");
        }

        if (currentRole != RoleEmploye && currentRole != RoleResponsable)
        {
            return Forbid("Vous n'avez pas le droit de créer une réclamation.");
        }

        if (string.IsNullOrWhiteSpace(dto.Title))
        {
            return BadRequest("Le titre de la réclamation est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.ProblemType))
        {
            return BadRequest("Le type de problème est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.Description))
        {
            return BadRequest("La description du problème est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.SourcePage))
        {
            return BadRequest("La page source est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.EntityName))
        {
            return BadRequest("Le nom de l'entité concernée est obligatoire.");
        }

        var creator = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value);

        if (creator == null)
        {
            return Unauthorized("Utilisateur introuvable.");
        }

        var creatorRole = NormalizeRole(creator.Role?.Name ?? currentRole);

        string assignedToRole;

        if (creatorRole == RoleEmploye)
        {
            // EMPLOYE -> RESPONSABLE
            assignedToRole = RoleResponsable;
        }
        else if (creatorRole == RoleResponsable)
        {
            // RESPONSABLE -> ADMIN directement
            assignedToRole = RoleAdmin;
        }
        else
        {
            return Forbid("Seuls les employés et les responsables peuvent créer une réclamation.");
        }

        var now = DateTime.Now;

        var reclamation = new Reclamation
        {
            Title = dto.Title.Trim(),
            ProblemType = dto.ProblemType.Trim(),
            Description = dto.Description.Trim(),
            ReclamationDate = dto.ReclamationDate ?? now,
            SourcePage = dto.SourcePage.Trim(),
            EntityName = dto.EntityName.Trim(),
            EntityId = dto.EntityId,
            EntityLabel = dto.EntityLabel?.Trim() ?? string.Empty,
            Status = StatusEnAttente,
            Priority = NormalizePriority(dto.Priority),
            AssignedToRole = assignedToRole,
            AssignedToUserId = null,
            CreatedByUserId = creator.Id,
            Decision = null,
            Resolution = null,
            TreatedAt = null,
            TreatedByUserId = null,
            CreatedAt = now,
            UpdatedAt = now
        };

        _context.Reclamations.Add(reclamation);
        await _context.SaveChangesAsync();

        await AddHistory(
            reclamation.Id,
            creator.Id,
            ActionCreate,
            string.Empty,
            StatusEnAttente,
            $"Réclamation créée par {creator.FullName} et envoyée à {assignedToRole}."
        );

        await AddArchive(
            creator.Id,
            creator.FullName,
            creatorRole,
            "Création réclamation",
            "Reclamation",
            reclamation.Id,
            $"Création d'une réclamation : {reclamation.Title}. Destinataire : {assignedToRole}.",
            null,
            new
            {
                reclamation.Id,
                reclamation.Title,
                reclamation.ProblemType,
                reclamation.SourcePage,
                reclamation.EntityName,
                reclamation.EntityId,
                reclamation.EntityLabel,
                reclamation.Priority,
                reclamation.AssignedToRole
            }
        );

        await NotifyUsersByRole(
            assignedToRole,
            "Nouvelle réclamation",
            $"{creator.FullName} a envoyé une réclamation : {reclamation.Title}.",
            "Reclamation"
        );

        await NotifyUser(
            creator.Id,
            "Réclamation envoyée",
            assignedToRole == RoleResponsable
                ? "Votre réclamation a été envoyée au responsable pour traitement."
                : "Votre réclamation a été envoyée à l'administrateur pour traitement.",
            "Reclamation"
        );

        await _context.SaveChangesAsync();

        var created = await GetLoadedReclamation(reclamation.Id);

        if (created == null)
        {
            return Ok();
        }

        return CreatedAtAction(nameof(GetById), new { id = created.Id }, ToDto(created));
    }

    // =========================================================
    // PUT : commencer traitement
    // =========================================================

    [HttpPut("{id:int}/start")]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    public async Task<IActionResult> StartTreatment(int id, StartReclamationDto dto)
    {
        var currentUserId = GetCurrentUserId();
        var currentRole = GetCurrentUserRole();

        if (currentUserId == null)
        {
            return Unauthorized("Utilisateur non authentifié.");
        }

        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value);

        if (user == null)
        {
            return Unauthorized("Utilisateur introuvable.");
        }

        var reclamation = await GetLoadedReclamation(id);

        if (reclamation == null)
        {
            return NotFound("Réclamation introuvable.");
        }

        if (!CanStartTreatment(reclamation, currentUserId.Value, currentRole))
        {
            return Forbid("Vous n'avez pas le droit de commencer le traitement de cette réclamation.");
        }

        if (IsClosed(reclamation))
        {
            return BadRequest("Cette réclamation est déjà clôturée ou traitée.");
        }

        var oldStatus = reclamation.Status;
        reclamation.Status = StatusEnCours;
        reclamation.AssignedToUserId = user.Id;
        reclamation.UpdatedAt = DateTime.Now;

        await AddHistory(
            reclamation.Id,
            user.Id,
            ActionStartTreatment,
            oldStatus,
            reclamation.Status,
            string.IsNullOrWhiteSpace(dto.Comment)
                ? $"Traitement commencé par {user.FullName}."
                : dto.Comment.Trim()
        );

        await AddArchive(
            user.Id,
            user.FullName,
            currentRole,
            "Début traitement réclamation",
            "Reclamation",
            reclamation.Id,
            $"Début de traitement de la réclamation : {reclamation.Title}.",
            new { oldStatus },
            new { newStatus = reclamation.Status, assignedToUserId = user.Id }
        );

        await NotifyUser(
            reclamation.CreatedByUserId,
            "Réclamation en cours de traitement",
            $"Votre réclamation \"{reclamation.Title}\" est maintenant en cours de traitement.",
            "Reclamation"
        );

        await _context.SaveChangesAsync();

        return Ok(new { message = "Traitement commencé avec succès." });
    }

    // =========================================================
    // PUT : escalade vers admin
    // =========================================================

    [HttpPut("{id:int}/escalate")]
    [Authorize(Roles = "RESPONSABLE")]
    public async Task<IActionResult> EscalateToAdmin(int id, EscalateReclamationDto dto)
    {
        var currentUserId = GetCurrentUserId();
        var currentRole = GetCurrentUserRole();

        if (currentUserId == null)
        {
            return Unauthorized("Utilisateur non authentifié.");
        }

        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value);

        if (user == null)
        {
            return Unauthorized("Utilisateur introuvable.");
        }

        var reclamation = await GetLoadedReclamation(id);

        if (reclamation == null)
        {
            return NotFound("Réclamation introuvable.");
        }

        if (!CanEscalateToAdmin(reclamation, currentUserId.Value, currentRole))
        {
            return Forbid("Vous n'avez pas le droit de transférer cette réclamation à l'administrateur.");
        }

        if (IsClosed(reclamation))
        {
            return BadRequest("Cette réclamation est déjà clôturée ou traitée.");
        }

        if (string.IsNullOrWhiteSpace(dto.Reason))
        {
            return BadRequest("La raison du transfert vers l'administrateur est obligatoire.");
        }

        var oldStatus = reclamation.Status;
        var oldAssignedToRole = reclamation.AssignedToRole;

        reclamation.Status = StatusEscaladeeAdmin;
        reclamation.AssignedToRole = RoleAdmin;
        reclamation.AssignedToUserId = null;
        reclamation.Priority = NormalizePriority(dto.Priority);
        reclamation.UpdatedAt = DateTime.Now;

        await AddHistory(
            reclamation.Id,
            user.Id,
            ActionEscalateToAdmin,
            oldStatus,
            reclamation.Status,
            dto.Reason.Trim()
        );

        await AddArchive(
            user.Id,
            user.FullName,
            currentRole,
            "Transfert réclamation à l'admin",
            "Reclamation",
            reclamation.Id,
            $"Réclamation transférée à l'administrateur : {reclamation.Title}.",
            new
            {
                oldStatus,
                oldAssignedToRole
            },
            new
            {
                newStatus = reclamation.Status,
                newAssignedToRole = reclamation.AssignedToRole,
                priority = reclamation.Priority,
                reason = dto.Reason.Trim()
            }
        );

        await NotifyUsersByRole(
            RoleAdmin,
            "Réclamation transférée",
            $"Le responsable {user.FullName} a transféré une réclamation à l'admin : {reclamation.Title}.",
            "Reclamation"
        );

        await NotifyUser(
            reclamation.CreatedByUserId,
            "Réclamation transférée à l'admin",
            $"Votre réclamation \"{reclamation.Title}\" a été transférée à l'administrateur.",
            "Reclamation"
        );

        await _context.SaveChangesAsync();

        return Ok(new { message = "Réclamation transférée à l'administrateur avec succès." });
    }

    // =========================================================
    // PUT : traitement / décision
    // =========================================================

    [HttpPut("{id:int}/treat")]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    public async Task<IActionResult> Treat(int id, TreatReclamationDto dto)
    {
        var currentUserId = GetCurrentUserId();
        var currentRole = GetCurrentUserRole();

        if (currentUserId == null)
        {
            return Unauthorized("Utilisateur non authentifié.");
        }

        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value);

        if (user == null)
        {
            return Unauthorized("Utilisateur introuvable.");
        }

        var reclamation = await GetLoadedReclamation(id);

        if (reclamation == null)
        {
            return NotFound("Réclamation introuvable.");
        }

        if (!CanTreat(reclamation, currentUserId.Value, currentRole))
        {
            return Forbid("Vous n'avez pas le droit de traiter cette réclamation.");
        }

        if (IsClosed(reclamation))
        {
            return BadRequest("Cette réclamation est déjà clôturée ou traitée.");
        }

        if (string.IsNullOrWhiteSpace(dto.Decision))
        {
            return BadRequest("La décision est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.Resolution))
        {
            return BadRequest("La résolution est obligatoire.");
        }

        var newStatus = NormalizeTreatmentStatus(dto.Status);

        var oldStatus = reclamation.Status;

        reclamation.Status = newStatus;
        reclamation.Decision = dto.Decision.Trim();
        reclamation.Resolution = dto.Resolution.Trim();
        reclamation.TreatedAt = DateTime.Now;
        reclamation.TreatedByUserId = user.Id;
        reclamation.AssignedToUserId = user.Id;
        reclamation.UpdatedAt = DateTime.Now;

        await AddHistory(
            reclamation.Id,
            user.Id,
            ActionTreat,
            oldStatus,
            reclamation.Status,
            $"Décision : {reclamation.Decision}. Résolution : {reclamation.Resolution}"
        );

        await AddArchive(
            user.Id,
            user.FullName,
            currentRole,
            "Traitement réclamation",
            "Reclamation",
            reclamation.Id,
            $"Traitement de la réclamation : {reclamation.Title}. Statut : {reclamation.Status}.",
            new { oldStatus },
            new
            {
                newStatus = reclamation.Status,
                reclamation.Decision,
                reclamation.Resolution,
                treatedByUserId = user.Id
            }
        );

        await NotifyUser(
            reclamation.CreatedByUserId,
            "Réclamation traitée",
            $"Votre réclamation \"{reclamation.Title}\" a été traitée. Décision : {reclamation.Decision}.",
            "Reclamation"
        );

        await _context.SaveChangesAsync();

        return Ok(new { message = "Réclamation traitée avec succès." });
    }

    // =========================================================
    // DELETE
    // =========================================================

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> Delete(int id)
    {
        var currentUserId = GetCurrentUserId();
        var currentRole = GetCurrentUserRole();

        if (currentUserId == null)
        {
            return Unauthorized("Utilisateur non authentifié.");
        }

        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value);

        if (user == null)
        {
            return Unauthorized("Utilisateur introuvable.");
        }

        var reclamation = await GetLoadedReclamation(id);

        if (reclamation == null)
        {
            return NotFound("Réclamation introuvable.");
        }

        // L'admin peut supprimer seulement les réclamations qui relèvent de son circuit.
        if (!IsForAdminTreatment(reclamation))
        {
            return Forbid("Vous ne pouvez supprimer que les réclamations transférées à l'administrateur.");
        }

        await AddArchive(
            user.Id,
            user.FullName,
            currentRole,
            "Suppression réclamation",
            "Reclamation",
            reclamation.Id,
            $"Suppression de la réclamation : {reclamation.Title}.",
            new
            {
                reclamation.Id,
                reclamation.Title,
                reclamation.Status,
                reclamation.AssignedToRole,
                CreatedBy = reclamation.CreatedByUser?.FullName
            },
            null
        );

        _context.Reclamations.Remove(reclamation);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Réclamation supprimée avec succès." });
    }

    // =========================================================
    // DROITS MÉTIER
    // =========================================================

    private bool CanView(Reclamation reclamation, int currentUserId, string currentRole)
    {
        if (currentRole == RoleEmploye)
        {
            return reclamation.CreatedByUserId == currentUserId;
        }

        if (currentRole == RoleResponsable)
        {
            return
                (
                    reclamation.AssignedToRole == RoleResponsable &&
                    GetCreatorRole(reclamation) == RoleEmploye
                )
                ||
                reclamation.CreatedByUserId == currentUserId;
        }

        if (currentRole == RoleAdmin)
        {
            return IsForAdminTreatment(reclamation);
        }

        return false;
    }

    private bool CanStartTreatment(Reclamation reclamation, int currentUserId, string currentRole)
    {
        if (reclamation.CreatedByUserId == currentUserId)
        {
            return false;
        }

        if (currentRole == RoleResponsable)
        {
            return reclamation.AssignedToRole == RoleResponsable &&
                   GetCreatorRole(reclamation) == RoleEmploye &&
                   reclamation.Status == StatusEnAttente;
        }

        if (currentRole == RoleAdmin)
        {
            return IsForAdminTreatment(reclamation) &&
                   (reclamation.Status == StatusEnAttente ||
                    reclamation.Status == StatusEscaladeeAdmin);
        }

        return false;
    }

    private bool CanEscalateToAdmin(Reclamation reclamation, int currentUserId, string currentRole)
    {
        if (currentRole != RoleResponsable)
        {
            return false;
        }

        if (reclamation.CreatedByUserId == currentUserId)
        {
            return false;
        }

        return reclamation.AssignedToRole == RoleResponsable &&
               GetCreatorRole(reclamation) == RoleEmploye &&
               (reclamation.Status == StatusEnAttente ||
                reclamation.Status == StatusEnCours);
    }

    private bool CanTreat(Reclamation reclamation, int currentUserId, string currentRole)
    {
        if (reclamation.CreatedByUserId == currentUserId)
        {
            return false;
        }

        if (currentRole == RoleResponsable)
        {
            return reclamation.AssignedToRole == RoleResponsable &&
                   GetCreatorRole(reclamation) == RoleEmploye;
        }

        if (currentRole == RoleAdmin)
        {
            return IsForAdminTreatment(reclamation);
        }

        return false;
    }

    private bool IsForAdminTreatment(Reclamation reclamation)
    {
        return reclamation.AssignedToRole == RoleAdmin &&
               (
                   GetCreatorRole(reclamation) == RoleResponsable ||
                   reclamation.Status == StatusEscaladeeAdmin ||
                   reclamation.Histories.Any(h =>
                       h.Action == ActionEscalateToAdmin ||
                       h.NewStatus == StatusEscaladeeAdmin
                   )
               );
    }

    private bool IsClosed(Reclamation reclamation)
    {
        return reclamation.Status == StatusTraitee ||
               reclamation.Status == StatusRefusee ||
               reclamation.Status == StatusCloturee;
    }

    // =========================================================
    // HELPERS
    // =========================================================

    private async Task<Reclamation?> GetLoadedReclamation(int id)
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

    private async Task AddHistory(
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
            OldStatus = oldStatus ?? string.Empty,
            NewStatus = newStatus ?? string.Empty,
            Comment = comment ?? string.Empty,
            CreatedAt = DateTime.Now
        };

        _context.ReclamationHistories.Add(history);

        await Task.CompletedTask;
    }

    private async Task AddArchive(
        int userId,
        string userName,
        string role,
        string action,
        string entityName,
        int? entityId,
        string description,
        object? oldValues,
        object? newValues)
    {
        var archive = new ArchiveLog
        {
            UserId = userId,
            UserName = userName,
            Role = role,
            Action = action,
            EntityName = entityName,
            EntityId = entityId,
            Description = description,
            OldValues = oldValues == null ? null : System.Text.Json.JsonSerializer.Serialize(oldValues),
            NewValues = newValues == null ? null : System.Text.Json.JsonSerializer.Serialize(newValues),
            CreatedAt = DateTime.Now
        };

        _context.ArchiveLogs.Add(archive);

        await Task.CompletedTask;
    }

    private async Task NotifyUsersByRole(string roleName, string title, string message, string type)
    {
        var normalizedRole = NormalizeRole(roleName);

        var users = await _context.Users
            .Include(u => u.Role)
            .Where(u => u.Role != null && u.Role.Name == normalizedRole)
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
    }

    private async Task NotifyUser(int userId, string title, string message, string type)
    {
        var exists = await _context.Users.AnyAsync(u => u.Id == userId);

        if (!exists)
        {
            return;
        }

        _context.UserNotifications.Add(new UserNotification
        {
            UserId = userId,
            Title = title,
            Message = message,
            Type = type,
            IsRead = false,
            CreatedAt = DateTime.Now
        });
    }

    private ReclamationDto ToDto(Reclamation reclamation)
    {
        return new ReclamationDto
        {
            Id = reclamation.Id,
            Title = reclamation.Title,
            ProblemType = reclamation.ProblemType,
            Description = reclamation.Description,
            ReclamationDate = reclamation.ReclamationDate,
            SourcePage = reclamation.SourcePage,
            EntityName = reclamation.EntityName,
            EntityId = reclamation.EntityId,
            EntityLabel = reclamation.EntityLabel,
            Status = reclamation.Status,
            Priority = reclamation.Priority,
            AssignedToRole = reclamation.AssignedToRole,
            AssignedToUserId = reclamation.AssignedToUserId,
            AssignedToUserName = reclamation.AssignedToUser?.FullName ?? string.Empty,
            CreatedByUserId = reclamation.CreatedByUserId,
            CreatedByUserName = reclamation.CreatedByUser?.FullName ?? string.Empty,
            CreatedByUserRole = GetCreatorRole(reclamation),
            Decision = reclamation.Decision,
            Resolution = reclamation.Resolution,
            TreatedAt = reclamation.TreatedAt,
            TreatedByUserId = reclamation.TreatedByUserId,
            TreatedByUserName = reclamation.TreatedByUser?.FullName ?? string.Empty,
            CreatedAt = reclamation.CreatedAt,
            UpdatedAt = reclamation.UpdatedAt,
            Histories = reclamation.Histories
                .OrderByDescending(h => h.CreatedAt)
                .Select(h => new ReclamationHistoryDto
                {
                    Id = h.Id,
                    ReclamationId = h.ReclamationId,
                    ActionByUserId = h.ActionByUserId,
                    ActionByUserName = h.ActionByUser?.FullName ?? string.Empty,
                    Action = h.Action,
                    OldStatus = h.OldStatus,
                    NewStatus = h.NewStatus,
                    Comment = h.Comment,
                    CreatedAt = h.CreatedAt
                })
                .ToList()
        };
    }

    private int? GetCurrentUserId()
    {
        var idClaim =
            User.FindFirstValue(ClaimTypes.NameIdentifier) ??
            User.FindFirstValue("sub") ??
            User.FindFirstValue("id") ??
            User.FindFirstValue("userId");

        return int.TryParse(idClaim, out var userId) ? userId : null;
    }

    private string GetCurrentUserRole()
    {
        var role =
            User.FindFirstValue(ClaimTypes.Role) ??
            User.FindFirstValue("role") ??
            string.Empty;

        return NormalizeRole(role);
    }

    private string GetCreatorRole(Reclamation reclamation)
    {
        return NormalizeRole(reclamation.CreatedByUser?.Role?.Name ?? string.Empty);
    }

    private string NormalizeRole(string? role)
    {
        return (role ?? string.Empty)
            .Trim()
            .ToUpperInvariant()
            .Replace("É", "E");
    }

    private string NormalizePriority(string? priority)
    {
        var value = (priority ?? "NORMALE").Trim().ToUpperInvariant();

        return value switch
        {
            "BASSE" => "BASSE",
            "NORMALE" => "NORMALE",
            "HAUTE" => "HAUTE",
            "URGENTE" => "URGENTE",
            _ => "NORMALE"
        };
    }

    private string NormalizeTreatmentStatus(string? status)
    {
        var value = (status ?? StatusTraitee).Trim().ToUpperInvariant();

        return value switch
        {
            StatusTraitee => StatusTraitee,
            StatusRefusee => StatusRefusee,
            StatusCloturee => StatusCloturee,
            _ => StatusTraitee
        };
    }
}