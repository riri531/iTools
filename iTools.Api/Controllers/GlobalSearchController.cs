using System.Security.Claims;
using iTools.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iTools.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class GlobalSearchController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public GlobalSearchController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [Authorize(Roles = "ADMIN,RESPONSABLE,EMPLOYE")]
    public async Task<ActionResult<IEnumerable<GlobalSearchResultDto>>> Search([FromQuery] string keyword)
    {
        keyword = (keyword ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(keyword))
        {
            return Ok(Array.Empty<GlobalSearchResultDto>());
        }

        var role = GetCurrentUserRole();
        var results = new List<GlobalSearchResultDto>();
        var q = Normalize(keyword);

        AddStaticPageResults(results, q, role);

        var designations = await _context.Designations
            .AsNoTracking()
            .Where(d =>
                NormalizeForSql(d.Name).Contains(q) ||
                NormalizeForSql(d.Type).Contains(q))
            .OrderBy(d => d.Name)
            .Take(10)
            .Select(d => new
            {
                d.Id,
                d.Name,
                d.Type
            })
            .ToListAsync();

        foreach (var designation in designations)
        {
            results.Add(new GlobalSearchResultDto
            {
                Type = "Désignation",
                Label = designation.Name,
                Description = $"Ouvrir les outils liés à la désignation {designation.Name}",
                Route = BuildDesignationToolsRoute(designation.Id),
                Icon = "/icons/outils.png",
                Score = GetScore(keyword, designation.Name, "Désignation")
            });
        }

        var outils = await _context.Outils
            .AsNoTracking()
            .Include(o => o.Ligne)
            .Include(o => o.Client)
            .Include(o => o.Fournisseur)
            .Include(o => o.Emplacement)
                .ThenInclude(e => e!.Designation)
            .Where(o =>
                NormalizeForSql(o.CodeOutillage).Contains(q) ||
                NormalizeForSql(o.OTT).Contains(q) ||
                NormalizeForSql(o.Status).Contains(q) ||
                (o.JustificationHS != null && NormalizeForSql(o.JustificationHS).Contains(q)) ||
                (o.Ligne != null && NormalizeForSql(o.Ligne.Nom).Contains(q)) ||
                (o.Client != null && NormalizeForSql(o.Client.NomClient).Contains(q)) ||
                (o.Fournisseur != null && NormalizeForSql(o.Fournisseur.NomFournisseur).Contains(q)) ||
                (o.Emplacement != null && NormalizeForSql(o.Emplacement.Armoire).Contains(q)) ||
                (o.Emplacement != null && NormalizeForSql(o.Emplacement.Numero).Contains(q)) ||
                (o.Emplacement != null && o.Emplacement.Designation != null && NormalizeForSql(o.Emplacement.Designation.Name).Contains(q)))
            .OrderBy(o => o.CodeOutillage)
            .Take(10)
            .Select(o => new
            {
                o.Id,
                o.CodeOutillage,
                o.OTT,
                o.Status,
                DesignationId = o.Emplacement != null && o.Emplacement.Designation != null
                    ? o.Emplacement.Designation.Id
                    : 0,
                DesignationName = o.Emplacement != null && o.Emplacement.Designation != null
                    ? o.Emplacement.Designation.Name
                    : "",
                EmplacementLabel = o.Emplacement != null
                    ? o.Emplacement.Armoire + " - " + o.Emplacement.Numero
                    : ""
            })
            .ToListAsync();

        foreach (var outil in outils)
        {
            var route = outil.DesignationId > 0
                ? $"{BuildDesignationToolsRoute(outil.DesignationId)}?outilId={outil.Id}"
                : "/app/outillages";

            results.Add(new GlobalSearchResultDto
            {
                Type = "Outil",
                Label = outil.CodeOutillage,
                Description = $"OTT : {outil.OTT} | Statut : {outil.Status} | {outil.EmplacementLabel}",
                Route = route,
                Icon = "/icons/outils.png",
                Score = GetScore(keyword, outil.CodeOutillage, "Outil")
            });
        }

        var emplacements = await _context.Emplacements
            .AsNoTracking()
            .Include(e => e.Matiere)
            .Include(e => e.Designation)
            .Where(e =>
                NormalizeForSql(e.Armoire).Contains(q) ||
                NormalizeForSql(e.Numero).Contains(q) ||
                NormalizeForSql(e.Status).Contains(q) ||
                (e.Matiere != null && NormalizeForSql(e.Matiere.NomMatiere).Contains(q)) ||
                (e.Designation != null && NormalizeForSql(e.Designation.Name).Contains(q)))
            .OrderBy(e => e.Armoire)
            .ThenBy(e => e.Numero)
            .Take(10)
            .Select(e => new
            {
                e.Id,
                e.Armoire,
                e.Numero,
                e.Status,
                MatiereName = e.Matiere != null ? e.Matiere.NomMatiere : "",
                DesignationName = e.Designation != null ? e.Designation.Name : ""
            })
            .ToListAsync();

        foreach (var emplacement in emplacements)
        {
            results.Add(new GlobalSearchResultDto
            {
                Type = "Emplacement",
                Label = $"{emplacement.Armoire} - {emplacement.Numero}",
                Description = $"Statut : {emplacement.Status} | Matière : {emplacement.MatiereName} | Désignation : {emplacement.DesignationName}",
                Route = $"/app/emplacements?q={Uri.EscapeDataString(keyword)}",
                Icon = "/icons/emplacement.png",
                Score = GetScore(keyword, $"{emplacement.Armoire} {emplacement.Numero}", "Emplacement")
            });
        }

        if (CanAccess(role, "ADMIN", "RESPONSABLE"))
        {
            var lignes = await _context.Lignes
                .AsNoTracking()
                .Where(l => NormalizeForSql(l.Nom).Contains(q))
                .OrderBy(l => l.Nom)
                .Take(10)
                .Select(l => new
                {
                    l.Id,
                    l.Nom
                })
                .ToListAsync();

            foreach (var ligne in lignes)
            {
                results.Add(new GlobalSearchResultDto
                {
                    Type = "Ligne",
                    Label = ligne.Nom,
                    Description = "Ligne de production",
                    Route = $"/app/lignes?q={Uri.EscapeDataString(keyword)}",
                    Icon = "/icons/lignes.png",
                    Score = GetScore(keyword, ligne.Nom, "Ligne")
                });
            }

            var clients = await _context.Clients
                .AsNoTracking()
                .Where(c => NormalizeForSql(c.NomClient).Contains(q))
                .OrderBy(c => c.NomClient)
                .Take(10)
                .Select(c => new
                {
                    c.Id,
                    c.NomClient
                })
                .ToListAsync();

            foreach (var client in clients)
            {
                results.Add(new GlobalSearchResultDto
                {
                    Type = "Client",
                    Label = client.NomClient,
                    Description = "Client",
                    Route = $"/app/clients?q={Uri.EscapeDataString(keyword)}",
                    Icon = "/icons/clients.png",
                    Score = GetScore(keyword, client.NomClient, "Client")
                });
            }

            var fournisseurs = await _context.Fournisseurs
                .AsNoTracking()
                .Where(f => NormalizeForSql(f.NomFournisseur).Contains(q))
                .OrderBy(f => f.NomFournisseur)
                .Take(10)
                .Select(f => new
                {
                    f.Id,
                    f.NomFournisseur
                })
                .ToListAsync();

            foreach (var fournisseur in fournisseurs)
            {
                results.Add(new GlobalSearchResultDto
                {
                    Type = "Fournisseur",
                    Label = fournisseur.NomFournisseur,
                    Description = "Fournisseur",
                    Route = $"/app/fournisseurs?q={Uri.EscapeDataString(keyword)}",
                    Icon = "/icons/fournisseurs.png",
                    Score = GetScore(keyword, fournisseur.NomFournisseur, "Fournisseur")
                });
            }

            var matieres = await _context.Matieres
                .AsNoTracking()
                .Where(m =>
                    NormalizeForSql(m.NomMatiere).Contains(q) ||
                    NormalizeForSql(m.Process).Contains(q))
                .OrderBy(m => m.NomMatiere)
                .Take(10)
                .Select(m => new
                {
                    m.Id,
                    m.NomMatiere,
                    m.Process
                })
                .ToListAsync();

            foreach (var matiere in matieres)
            {
                results.Add(new GlobalSearchResultDto
                {
                    Type = "Matière",
                    Label = matiere.NomMatiere,
                    Description = matiere.Process,
                    Route = $"/app/matieres?q={Uri.EscapeDataString(keyword)}",
                    Icon = "/icons/matiere.png",
                    Score = GetScore(keyword, matiere.NomMatiere, "Matière")
                });
            }
        }

        if (role == "ADMIN")
        {
            var users = await _context.Users
                .AsNoTracking()
                .Include(u => u.Role)
                .Where(u =>
                    NormalizeForSql(u.FullName).Contains(q) ||
                    NormalizeForSql(u.Email).Contains(q) ||
                    (u.Role != null && NormalizeForSql(u.Role.Name).Contains(q)))
                .OrderBy(u => u.FullName)
                .Take(10)
                .Select(u => new
                {
                    u.Id,
                    u.FullName,
                    u.Email,
                    RoleName = u.Role != null ? u.Role.Name : ""
                })
                .ToListAsync();

            foreach (var user in users)
            {
                results.Add(new GlobalSearchResultDto
                {
                    Type = "Utilisateur",
                    Label = user.FullName,
                    Description = $"{user.Email} | {user.RoleName}",
                    Route = $"/app/users?q={Uri.EscapeDataString(keyword)}",
                    Icon = "/icons/utilisateur.png",
                    Score = GetScore(keyword, user.FullName, "Utilisateur")
                });
            }

            var archives = await _context.ArchiveLogs
                .AsNoTracking()
                .Where(a =>
                    NormalizeForSql(a.Action).Contains(q) ||
                    NormalizeForSql(a.EntityName).Contains(q) ||
                    NormalizeForSql(a.Description).Contains(q) ||
                    NormalizeForSql(a.UserName).Contains(q))
                .OrderByDescending(a => a.CreatedAt)
                .Take(10)
                .Select(a => new
                {
                    a.Id,
                    a.Action,
                    a.EntityName,
                    a.Description,
                    a.CreatedAt
                })
                .ToListAsync();

            foreach (var archive in archives)
            {
                results.Add(new GlobalSearchResultDto
                {
                    Type = "Historique",
                    Label = $"{archive.Action} - {archive.EntityName}",
                    Description = archive.Description,
                    Route = $"/app/archives?q={Uri.EscapeDataString(keyword)}",
                    Icon = "/icons/historique.png",
                    Score = GetScore(keyword, $"{archive.Action} {archive.EntityName} {archive.Description}", "Historique")
                });
            }
        }

        var reclamations = await _context.Reclamations
            .AsNoTracking()
            .Where(r =>
                NormalizeForSql(r.Title).Contains(q) ||
                NormalizeForSql(r.Description).Contains(q) ||
                NormalizeForSql(r.ProblemType).Contains(q) ||
                NormalizeForSql(r.Status).Contains(q) ||
                NormalizeForSql(r.Priority).Contains(q) ||
                NormalizeForSql(r.SourcePage).Contains(q) ||
                NormalizeForSql(r.EntityName).Contains(q) ||
                NormalizeForSql(r.EntityLabel).Contains(q))
            .OrderByDescending(r => r.CreatedAt)
            .Take(10)
            .Select(r => new
            {
                r.Id,
                r.Title,
                r.Status,
                r.Priority
            })
            .ToListAsync();

        foreach (var reclamation in reclamations)
        {
            results.Add(new GlobalSearchResultDto
            {
                Type = "Réclamation",
                Label = reclamation.Title,
                Description = $"Statut : {reclamation.Status} | Priorité : {reclamation.Priority}",
                Route = $"/app/reclamations?q={Uri.EscapeDataString(keyword)}",
                Icon = "/icons/messages.png",
                Score = GetScore(keyword, reclamation.Title, "Réclamation")
            });
        }

        var ordered = results
            .OrderByDescending(r => r.Score)
            .ThenBy(r => r.Type)
            .ThenBy(r => r.Label)
            .Take(30)
            .ToList();

        return Ok(ordered);
    }

    private void AddStaticPageResults(List<GlobalSearchResultDto> results, string q, string role)
    {
        AddPageIfMatch(results, q, "Dashboard", "Tableau de bord et indicateurs", "/app/dashboard", "/icons/dashboard.png", role, "ADMIN", "RESPONSABLE", "EMPLOYE");
        AddPageIfMatch(results, q, "Outillages", "Liste des désignations et outils", "/app/outillages", "/icons/outils.png", role, "ADMIN", "RESPONSABLE", "EMPLOYE");
        AddPageIfMatch(results, q, "Lignes", "Gestion des lignes", "/app/lignes", "/icons/lignes.png", role, "ADMIN", "RESPONSABLE");
        AddPageIfMatch(results, q, "Clients", "Gestion des clients", "/app/clients", "/icons/clients.png", role, "ADMIN", "RESPONSABLE");
        AddPageIfMatch(results, q, "Fournisseurs", "Gestion des fournisseurs", "/app/fournisseurs", "/icons/fournisseurs.png", role, "ADMIN", "RESPONSABLE");
        AddPageIfMatch(results, q, "Utilisateurs inscrits", "Gestion des comptes utilisateurs", "/app/users", "/icons/utilisateur.png", role, "ADMIN");
        AddPageIfMatch(results, q, "Emplacements", "Gestion des emplacements", "/app/emplacements", "/icons/emplacement.png", role, "ADMIN", "RESPONSABLE", "EMPLOYE");
        AddPageIfMatch(results, q, "Matières", "Gestion des matières", "/app/matieres", "/icons/matiere.png", role, "ADMIN", "RESPONSABLE");
        AddPageIfMatch(results, q, "Assistance intelligente", "Aide et questions fréquentes", "/app/assistance", "/icons/assistance-intelligente.png", role, "ADMIN", "RESPONSABLE", "EMPLOYE");
        AddPageIfMatch(results, q, "Historique", "Archives et traçabilité", "/app/archives", "/icons/historique.png", role, "ADMIN");
    }

    private void AddPageIfMatch(
        List<GlobalSearchResultDto> results,
        string q,
        string label,
        string description,
        string route,
        string icon,
        string currentRole,
        params string[] allowedRoles)
    {
        if (!CanAccess(currentRole, allowedRoles))
        {
            return;
        }

        var searchable = Normalize($"{label} {description} {route}");

        if (!searchable.Contains(q))
        {
            return;
        }

        results.Add(new GlobalSearchResultDto
        {
            Type = "Page",
            Label = label,
            Description = description,
            Route = route,
            Icon = icon,
            Score = GetScore(q, label, "Page")
        });
    }

    private string BuildDesignationToolsRoute(int designationId)
    {
        return $"/app/outillages/{designationId}/outils";
    }

    private int GetScore(string keyword, string value, string type)
    {
        var q = Normalize(keyword);
        var text = Normalize(value);

        var score = 10;

        if (text == q)
        {
            score += 100;
        }
        else if (text.StartsWith(q))
        {
            score += 70;
        }
        else if (text.Contains(q))
        {
            score += 40;
        }

        if (type == "Désignation")
        {
            score += 25;
        }

        if (type == "Outil")
        {
            score += 20;
        }

        if (type == "Page")
        {
            score += 8;
        }

        return score;
    }

    private string GetCurrentUserRole()
    {
        var role =
            User.FindFirst(ClaimTypes.Role)?.Value ??
            User.FindFirst("role")?.Value ??
            User.FindFirst("Role")?.Value ??
            string.Empty;

        return NormalizeRole(role);
    }

    private string NormalizeRole(string value)
    {
        return (value ?? string.Empty)
            .Trim()
            .ToUpperInvariant()
            .Replace("É", "E");
    }

    private bool CanAccess(string currentRole, params string[] allowedRoles)
    {
        var normalizedAllowedRoles = allowedRoles
            .Select(NormalizeRole)
            .ToList();

        return normalizedAllowedRoles.Contains(NormalizeRole(currentRole));
    }

    private string Normalize(string value)
    {
        value = value ?? string.Empty;

        return value
            .Trim()
            .ToLowerInvariant()
            .Replace("é", "e")
            .Replace("è", "e")
            .Replace("ê", "e")
            .Replace("ë", "e")
            .Replace("à", "a")
            .Replace("â", "a")
            .Replace("ä", "a")
            .Replace("î", "i")
            .Replace("ï", "i")
            .Replace("ô", "o")
            .Replace("ö", "o")
            .Replace("ù", "u")
            .Replace("û", "u")
            .Replace("ü", "u")
            .Replace("ç", "c");
    }

    private static string NormalizeForSql(string? value)
    {
        value ??= string.Empty;

        return value
            .Trim()
            .ToLower()
            .Replace("é", "e")
            .Replace("è", "e")
            .Replace("ê", "e")
            .Replace("ë", "e")
            .Replace("à", "a")
            .Replace("â", "a")
            .Replace("ä", "a")
            .Replace("î", "i")
            .Replace("ï", "i")
            .Replace("ô", "o")
            .Replace("ö", "o")
            .Replace("ù", "u")
            .Replace("û", "u")
            .Replace("ü", "u")
            .Replace("ç", "c");
    }
}

public class GlobalSearchResultDto
{
    public string Type { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Route { get; set; } = string.Empty;
    public string Icon { get; set; } = string.Empty;
    public int Score { get; set; }
}
