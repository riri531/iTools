using System.Globalization;
using System.Security.Claims;
using System.Text;
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
        var normalizedKeyword = Normalize(keyword);
        var tokens = GetMeaningfulTokens(keyword);

        AddStaticPageResults(results, keyword, role);

        await SearchDesignations(results, keyword, normalizedKeyword, tokens);
        await SearchOutils(results, keyword, normalizedKeyword, tokens);
        await SearchEmplacements(results, keyword, normalizedKeyword, tokens);

        if (CanAccess(role, "ADMIN", "RESPONSABLE"))
        {
            await SearchLignes(results, keyword, normalizedKeyword, tokens);
            await SearchClients(results, keyword, normalizedKeyword, tokens);
            await SearchFournisseurs(results, keyword, normalizedKeyword, tokens);
            await SearchMatieres(results, keyword, normalizedKeyword, tokens);
        }

        if (role == "ADMIN")
        {
            await SearchUsers(results, keyword, normalizedKeyword, tokens);
            await SearchArchives(results, keyword, normalizedKeyword, tokens);
        }

        await SearchReclamations(results, keyword, normalizedKeyword, tokens);

        var ordered = results
            .GroupBy(r => $"{r.Type}|{r.Label}|{r.Route}")
            .Select(g => g.OrderByDescending(x => x.Score).First())
            .OrderByDescending(r => r.Score)
            .ThenBy(r => r.Type)
            .ThenBy(r => r.Label)
            .Take(30)
            .ToList();

        return Ok(ordered);
    }

    private async Task SearchDesignations(
        List<GlobalSearchResultDto> results,
        string originalKeyword,
        string normalizedKeyword,
        List<string> tokens)
    {
        var designations = await _context.Designations
            .AsNoTracking()
            .OrderBy(d => d.Name)
            .Select(d => new
            {
                d.Id,
                d.Name,
                d.Type
            })
            .ToListAsync();

        foreach (var designation in designations)
        {
            var searchable = $"{designation.Name} {designation.Type}";

            if (!MatchesSearch(searchable, normalizedKeyword, tokens))
            {
                continue;
            }

            results.Add(new GlobalSearchResultDto
            {
                Type = "Désignation",
                Label = designation.Name,
                Description = $"Ouvrir les outils liés à la désignation {designation.Name}",
                Route = BuildDesignationToolsRoute(designation.Id),
                Icon = "/icons/outils.png",
                Score = GetScore(originalKeyword, designation.Name, searchable, "Désignation")
            });
        }
    }

    private async Task SearchOutils(
        List<GlobalSearchResultDto> results,
        string originalKeyword,
        string normalizedKeyword,
        List<string> tokens)
    {
        var outils = await _context.Outils
            .AsNoTracking()
            .Include(o => o.Ligne)
            .Include(o => o.Client)
            .Include(o => o.Fournisseur)
            .Include(o => o.Emplacement)
                .ThenInclude(e => e!.Designation)
            .Include(o => o.Emplacement)
                .ThenInclude(e => e!.Matiere)
            .OrderBy(o => o.CodeOutillage)
            .Select(o => new
            {
                o.Id,
                o.CodeOutillage,
                o.OTT,
                o.Status,
                o.JustificationHS,
                LigneName = o.Ligne != null ? o.Ligne.Nom : "",
                ClientName = o.Client != null ? o.Client.NomClient : "",
                FournisseurName = o.Fournisseur != null ? o.Fournisseur.NomFournisseur : "",
                EmplacementLabel = o.Emplacement != null ? o.Emplacement.Armoire + " " + o.Emplacement.Numero : "",
                DesignationId = o.Emplacement != null && o.Emplacement.Designation != null ? o.Emplacement.Designation.Id : 0,
                DesignationName = o.Emplacement != null && o.Emplacement.Designation != null ? o.Emplacement.Designation.Name : "",
                MatiereName = o.Emplacement != null && o.Emplacement.Matiere != null ? o.Emplacement.Matiere.NomMatiere : ""
            })
            .ToListAsync();

        foreach (var outil in outils)
        {
            var searchable = $"{outil.CodeOutillage} {outil.OTT} {outil.Status} {outil.JustificationHS} {outil.LigneName} {outil.ClientName} {outil.FournisseurName} {outil.EmplacementLabel} {outil.DesignationName} {outil.MatiereName}";

            if (!MatchesSearch(searchable, normalizedKeyword, tokens))
            {
                continue;
            }

            var route = outil.DesignationId > 0
                ? $"{BuildDesignationToolsRoute(outil.DesignationId)}?outilId={outil.Id}"
                : "/app/outillages";

            results.Add(new GlobalSearchResultDto
            {
                Type = "Outil",
                Label = string.IsNullOrWhiteSpace(outil.CodeOutillage) ? outil.OTT : outil.CodeOutillage,
                Description = $"OTT : {outil.OTT} | Statut : {outil.Status} | Désignation : {outil.DesignationName}",
                Route = route,
                Icon = "/icons/outils.png",
                Score = GetScore(originalKeyword, outil.CodeOutillage + " " + outil.OTT, searchable, "Outil")
            });
        }
    }

    private async Task SearchEmplacements(
        List<GlobalSearchResultDto> results,
        string originalKeyword,
        string normalizedKeyword,
        List<string> tokens)
    {
        var emplacements = await _context.Emplacements
            .AsNoTracking()
            .Include(e => e.Matiere)
            .Include(e => e.Designation)
            .OrderBy(e => e.Armoire)
            .ThenBy(e => e.Numero)
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
            var label = $"{emplacement.Armoire} - {emplacement.Numero}";
            var searchable = $"{label} {emplacement.Status} {emplacement.MatiereName} {emplacement.DesignationName}";

            if (!MatchesSearch(searchable, normalizedKeyword, tokens))
            {
                continue;
            }

            results.Add(new GlobalSearchResultDto
            {
                Type = "Emplacement",
                Label = label,
                Description = $"Statut : {emplacement.Status} | Matière : {emplacement.MatiereName} | Désignation : {emplacement.DesignationName}",
                Route = $"/app/emplacements?q={Uri.EscapeDataString(originalKeyword)}",
                Icon = "/icons/emplacement.png",
                Score = GetScore(originalKeyword, label, searchable, "Emplacement")
            });
        }
    }

    private async Task SearchLignes(List<GlobalSearchResultDto> results, string originalKeyword, string normalizedKeyword, List<string> tokens)
    {
        var lignes = await _context.Lignes
            .AsNoTracking()
            .OrderBy(l => l.Nom)
            .Select(l => new { l.Id, l.Nom })
            .ToListAsync();

        foreach (var ligne in lignes)
        {
            if (!MatchesSearch(ligne.Nom, normalizedKeyword, tokens)) continue;

            results.Add(new GlobalSearchResultDto
            {
                Type = "Ligne",
                Label = ligne.Nom,
                Description = "Ligne de production",
                Route = $"/app/lignes?q={Uri.EscapeDataString(originalKeyword)}",
                Icon = "/icons/lignes.png",
                Score = GetScore(originalKeyword, ligne.Nom, ligne.Nom, "Ligne")
            });
        }
    }

    private async Task SearchClients(List<GlobalSearchResultDto> results, string originalKeyword, string normalizedKeyword, List<string> tokens)
    {
        var clients = await _context.Clients
            .AsNoTracking()
            .OrderBy(c => c.NomClient)
            .Select(c => new { c.Id, c.NomClient })
            .ToListAsync();

        foreach (var client in clients)
        {
            if (!MatchesSearch(client.NomClient, normalizedKeyword, tokens)) continue;

            results.Add(new GlobalSearchResultDto
            {
                Type = "Client",
                Label = client.NomClient,
                Description = "Client",
                Route = $"/app/clients?q={Uri.EscapeDataString(originalKeyword)}",
                Icon = "/icons/clients.png",
                Score = GetScore(originalKeyword, client.NomClient, client.NomClient, "Client")
            });
        }
    }

    private async Task SearchFournisseurs(List<GlobalSearchResultDto> results, string originalKeyword, string normalizedKeyword, List<string> tokens)
    {
        var fournisseurs = await _context.Fournisseurs
            .AsNoTracking()
            .OrderBy(f => f.NomFournisseur)
            .Select(f => new { f.Id, f.NomFournisseur })
            .ToListAsync();

        foreach (var fournisseur in fournisseurs)
        {
            if (!MatchesSearch(fournisseur.NomFournisseur, normalizedKeyword, tokens)) continue;

            results.Add(new GlobalSearchResultDto
            {
                Type = "Fournisseur",
                Label = fournisseur.NomFournisseur,
                Description = "Fournisseur",
                Route = $"/app/fournisseurs?q={Uri.EscapeDataString(originalKeyword)}",
                Icon = "/icons/fournisseurs.png",
                Score = GetScore(originalKeyword, fournisseur.NomFournisseur, fournisseur.NomFournisseur, "Fournisseur")
            });
        }
    }

    private async Task SearchMatieres(List<GlobalSearchResultDto> results, string originalKeyword, string normalizedKeyword, List<string> tokens)
    {
        var matieres = await _context.Matieres
            .AsNoTracking()
            .OrderBy(m => m.NomMatiere)
            .Select(m => new
            {
                m.Id,
                m.NomMatiere,
                m.Process
            })
            .ToListAsync();

        foreach (var matiere in matieres)
        {
            var searchable = $"{matiere.NomMatiere} {matiere.Process}";
            if (!MatchesSearch(searchable, normalizedKeyword, tokens)) continue;

            results.Add(new GlobalSearchResultDto
            {
                Type = "Matière",
                Label = matiere.NomMatiere,
                Description = string.IsNullOrWhiteSpace(matiere.Process) ? "Matière" : matiere.Process,
                Route = $"/app/matieres?q={Uri.EscapeDataString(originalKeyword)}",
                Icon = "/icons/matiere.png",
                Score = GetScore(originalKeyword, matiere.NomMatiere, searchable, "Matière")
            });
        }
    }

    private async Task SearchUsers(List<GlobalSearchResultDto> results, string originalKeyword, string normalizedKeyword, List<string> tokens)
    {
        var users = await _context.Users
            .AsNoTracking()
            .Include(u => u.Role)
            .OrderBy(u => u.FullName)
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
            var searchable = $"{user.FullName} {user.Email} {user.RoleName}";
            if (!MatchesSearch(searchable, normalizedKeyword, tokens)) continue;

            results.Add(new GlobalSearchResultDto
            {
                Type = "Utilisateur",
                Label = user.FullName,
                Description = $"{user.Email} | {user.RoleName}",
                Route = $"/app/users?q={Uri.EscapeDataString(originalKeyword)}",
                Icon = "/icons/utilisateur.png",
                Score = GetScore(originalKeyword, user.FullName, searchable, "Utilisateur")
            });
        }
    }

    private async Task SearchArchives(List<GlobalSearchResultDto> results, string originalKeyword, string normalizedKeyword, List<string> tokens)
    {
        var archives = await _context.ArchiveLogs
            .AsNoTracking()
            .OrderByDescending(a => a.CreatedAt)
            .Take(500)
            .Select(a => new
            {
                a.Id,
                a.Action,
                a.EntityName,
                a.Description,
                a.UserName,
                a.CreatedAt
            })
            .ToListAsync();

        foreach (var archive in archives)
        {
            var searchable = $"{archive.Action} {archive.EntityName} {archive.Description} {archive.UserName}";
            if (!MatchesSearch(searchable, normalizedKeyword, tokens)) continue;

            results.Add(new GlobalSearchResultDto
            {
                Type = "Historique",
                Label = $"{archive.Action} - {archive.EntityName}",
                Description = archive.Description,
                Route = $"/app/archives?q={Uri.EscapeDataString(originalKeyword)}",
                Icon = "/icons/historique.png",
                Score = GetScore(originalKeyword, archive.Action + " " + archive.EntityName, searchable, "Historique")
            });
        }
    }

    private async Task SearchReclamations(List<GlobalSearchResultDto> results, string originalKeyword, string normalizedKeyword, List<string> tokens)
    {
        var role = GetCurrentUserRole();
        var currentUserId = GetCurrentUserId();

        var query = _context.Reclamations
            .AsNoTracking()
            .OrderByDescending(r => r.CreatedAt)
            .AsQueryable();

        if (role == "EMPLOYE" && currentUserId.HasValue)
        {
            query = query.Where(r => r.CreatedByUserId == currentUserId.Value);
        }
        else if (role == "RESPONSABLE")
        {
            query = query.Where(r => r.AssignedToRole == "RESPONSABLE" || (currentUserId.HasValue && r.CreatedByUserId == currentUserId.Value));
        }
        else if (role == "ADMIN")
        {
            query = query.Where(r => r.AssignedToRole == "ADMIN");
        }

        var reclamations = await query
            .Take(500)
            .Select(r => new
            {
                r.Id,
                r.Title,
                r.Description,
                r.ProblemType,
                r.Status,
                r.Priority,
                r.SourcePage,
                r.EntityName,
                r.EntityLabel
            })
            .ToListAsync();

        foreach (var reclamation in reclamations)
        {
            var searchable = $"{reclamation.Title} {reclamation.Description} {reclamation.ProblemType} {reclamation.Status} {reclamation.Priority} {reclamation.SourcePage} {reclamation.EntityName} {reclamation.EntityLabel}";
            if (!MatchesSearch(searchable, normalizedKeyword, tokens)) continue;

            results.Add(new GlobalSearchResultDto
            {
                Type = "Réclamation",
                Label = reclamation.Title,
                Description = $"Statut : {reclamation.Status} | Priorité : {reclamation.Priority}",
                Route = $"/app/reclamations?q={Uri.EscapeDataString(originalKeyword)}",
                Icon = "/icons/messages.png",
                Score = GetScore(originalKeyword, reclamation.Title, searchable, "Réclamation")
            });
        }
    }

    private void AddStaticPageResults(List<GlobalSearchResultDto> results, string keyword, string role)
    {
        AddPageIfMatch(results, keyword, "Dashboard", "Tableau de bord et indicateurs", "/app/dashboard", "/icons/dashboard.png", role, "ADMIN", "RESPONSABLE", "EMPLOYE");
        AddPageIfMatch(results, keyword, "Outillages", "Liste des désignations et outils", "/app/outillages", "/icons/outils.png", role, "ADMIN", "RESPONSABLE", "EMPLOYE");
        AddPageIfMatch(results, keyword, "Lignes", "Gestion des lignes", "/app/lignes", "/icons/lignes.png", role, "ADMIN", "RESPONSABLE");
        AddPageIfMatch(results, keyword, "Clients", "Gestion des clients", "/app/clients", "/icons/clients.png", role, "ADMIN", "RESPONSABLE");
        AddPageIfMatch(results, keyword, "Fournisseurs", "Gestion des fournisseurs", "/app/fournisseurs", "/icons/fournisseurs.png", role, "ADMIN", "RESPONSABLE");
        AddPageIfMatch(results, keyword, "Utilisateurs inscrits", "Gestion des comptes utilisateurs", "/app/users", "/icons/utilisateur.png", role, "ADMIN");
        AddPageIfMatch(results, keyword, "Emplacements", "Gestion des emplacements", "/app/emplacements", "/icons/emplacement.png", role, "ADMIN", "RESPONSABLE", "EMPLOYE");
        AddPageIfMatch(results, keyword, "Matières", "Gestion des matières", "/app/matieres", "/icons/matiere.png", role, "ADMIN", "RESPONSABLE");
        AddPageIfMatch(results, keyword, "Assistance intelligente", "Aide et questions fréquentes", "/app/assistance", "/icons/assistance-intelligente.png", role, "ADMIN", "RESPONSABLE", "EMPLOYE");
        AddPageIfMatch(results, keyword, "Historique", "Archives et traçabilité", "/app/archives", "/icons/historique.png", role, "ADMIN");
    }

    private void AddPageIfMatch(List<GlobalSearchResultDto> results, string keyword, string label, string description, string route, string icon, string currentRole, params string[] allowedRoles)
    {
        if (!CanAccess(currentRole, allowedRoles)) return;

        var searchable = $"{label} {description} {route}";
        var tokens = GetMeaningfulTokens(keyword);

        if (!MatchesSearch(searchable, Normalize(keyword), tokens)) return;

        results.Add(new GlobalSearchResultDto
        {
            Type = "Page",
            Label = label,
            Description = description,
            Route = route,
            Icon = icon,
            Score = GetScore(keyword, label, searchable, "Page")
        });
    }

    private string BuildDesignationToolsRoute(int designationId)
    {
        return $"/app/outillages/{designationId}/outils";
    }

    private bool MatchesSearch(string searchableText, string normalizedKeyword, List<string> tokens)
    {
        var text = Normalize(searchableText);

        if (string.IsNullOrWhiteSpace(text))
        {
            return false;
        }

        if (text.Contains(normalizedKeyword))
        {
            return true;
        }

        if (tokens.Count == 0)
        {
            return false;
        }

        return tokens.All(token => text.Contains(token));
    }

    private int GetScore(string keyword, string mainValue, string searchableText, string type)
    {
        var q = Normalize(keyword);
        var main = Normalize(mainValue);
        var searchable = Normalize(searchableText);
        var tokens = GetMeaningfulTokens(keyword);

        var score = 10;

        if (main == q) score += 120;
        else if (main.StartsWith(q)) score += 90;
        else if (main.Contains(q)) score += 70;
        else if (tokens.Count > 0 && tokens.All(t => main.Contains(t))) score += 60;
        else if (tokens.Count > 0 && tokens.All(t => searchable.Contains(t))) score += 45;

        if (type == "Désignation") score += 35;
        if (type == "Outil") score += 25;
        if (type == "Page") score += 8;

        return score;
    }

    private List<string> GetMeaningfulTokens(string value)
    {
        var stopWords = new HashSet<string>
        {
            "de", "du", "des", "le", "la", "les", "l", "d", "un", "une", "et", "a", "au", "aux"
        };

        return Normalize(value)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(token => token.Length >= 2 && !stopWords.Contains(token))
            .Distinct()
            .ToList();
    }

    private int? GetCurrentUserId()
    {
        var idClaim =
            User.FindFirstValue(ClaimTypes.NameIdentifier) ??
            User.FindFirstValue("sub") ??
            User.FindFirstValue("id") ??
            User.FindFirstValue("userId");

        return int.TryParse(idClaim, out var id) ? id : null;
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
        var normalizedAllowedRoles = allowedRoles.Select(NormalizeRole).ToList();
        return normalizedAllowedRoles.Contains(NormalizeRole(currentRole));
    }

    private string Normalize(string value)
    {
        value = value ?? string.Empty;

        var normalized = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder();

        foreach (var ch in normalized)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(ch);
            if (category != UnicodeCategory.NonSpacingMark)
            {
                builder.Append(ch);
            }
        }

        return builder
            .ToString()
            .Normalize(NormalizationForm.FormC)
            .ToLowerInvariant()
            .Replace("'", " ")
            .Replace("-", " ")
            .Replace("_", " ")
            .Replace("/", " ")
            .Replace(".", " ")
            .Replace(",", " ")
            .Replace(";", " ")
            .Replace(":", " ")
            .Replace("(", " ")
            .Replace(")", " ")
            .Trim();
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
