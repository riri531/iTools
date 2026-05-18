using iTools.Api.Data;
using iTools.Api.DTOs;
using iTools.Api.Models;
using iTools.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iTools.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OutilsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ArchiveService _archiveService;

    public OutilsController(
        ApplicationDbContext context,
        ArchiveService archiveService)
    {
        _context = context;
        _archiveService = archiveService;
    }

    [HttpGet]
    [Authorize(Roles = "ADMIN,RESPONSABLE,EMPLOYE")]
    public async Task<ActionResult<IEnumerable<OutilDto>>> GetAll()
    {
        var items = await _context.Outils
            .Include(o => o.Ligne)
            .Include(o => o.Client)
            .Include(o => o.Fournisseur)
            .Include(o => o.Emplacement)
            .OrderBy(o => o.Id)
            .Select(o => new OutilDto
            {
                Id = o.Id,
                LigneId = o.LigneId,
                LigneName = o.Ligne != null ? o.Ligne.Nom : "",
                ClientId = o.ClientId,
                ClientName = o.Client != null ? o.Client.NomClient : "",
                FournisseurId = o.FournisseurId,
                FournisseurName = o.Fournisseur != null ? o.Fournisseur.NomFournisseur : "",
                EmplacementId = o.EmplacementId,
                EmplacementLabel = o.Emplacement != null ? (o.Emplacement.Armoire + " - " + o.Emplacement.Numero) : "",
                OTT = o.OTT,
                CodeOutillage = o.CodeOutillage,
                Status = o.Status,
                Valeur = o.Valeur,
                JustificationHS = o.JustificationHS,
                DateAffectation = o.DateAffectation
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id}")]
    [Authorize(Roles = "ADMIN,RESPONSABLE,EMPLOYE")]
    public async Task<ActionResult<OutilDto>> GetById(int id)
    {
        var item = await _context.Outils
            .Include(o => o.Ligne)
            .Include(o => o.Client)
            .Include(o => o.Fournisseur)
            .Include(o => o.Emplacement)
            .Where(o => o.Id == id)
            .Select(o => new OutilDto
            {
                Id = o.Id,
                LigneId = o.LigneId,
                LigneName = o.Ligne != null ? o.Ligne.Nom : "",
                ClientId = o.ClientId,
                ClientName = o.Client != null ? o.Client.NomClient : "",
                FournisseurId = o.FournisseurId,
                FournisseurName = o.Fournisseur != null ? o.Fournisseur.NomFournisseur : "",
                EmplacementId = o.EmplacementId,
                EmplacementLabel = o.Emplacement != null ? (o.Emplacement.Armoire + " - " + o.Emplacement.Numero) : "",
                OTT = o.OTT,
                CodeOutillage = o.CodeOutillage,
                Status = o.Status,
                Valeur = o.Valeur,
                JustificationHS = o.JustificationHS,
                DateAffectation = o.DateAffectation
            })
            .FirstOrDefaultAsync();

        if (item == null)
        {
            return NotFound("Outil introuvable.");
        }

        return Ok(item);
    }

    [HttpPost]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    public async Task<ActionResult<OutilDto>> Create(CreateOutilDto dto)
    {
        if (dto.LigneId <= 0)
        {
            return BadRequest("La ligne est obligatoire.");
        }

        if (dto.ClientId <= 0)
        {
            return BadRequest("Le client est obligatoire.");
        }

        if (dto.FournisseurId <= 0)
        {
            return BadRequest("Le fournisseur est obligatoire.");
        }

        if (dto.EmplacementId <= 0)
        {
            return BadRequest("L’emplacement est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.OTT))
        {
            return BadRequest("L’OTT est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.CodeOutillage))
        {
            return BadRequest("Le code outillage est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.Status))
        {
            return BadRequest("Le statut est obligatoire.");
        }

        var ott = dto.OTT.Trim();
        var codeOutillage = dto.CodeOutillage.Trim();
        var status = dto.Status.Trim();
        var justificationHS = dto.JustificationHS?.Trim();

        if (status == "HS" && string.IsNullOrWhiteSpace(justificationHS))
        {
            return BadRequest("La justification HS est obligatoire lorsque le statut est HS.");
        }

        if (status != "HS")
        {
            justificationHS = "";
        }

        var ligneExists = await _context.Lignes.AnyAsync(x => x.Id == dto.LigneId);
        if (!ligneExists)
        {
            return BadRequest("LigneId invalide.");
        }

        var clientExists = await _context.Clients.AnyAsync(x => x.Id == dto.ClientId);
        if (!clientExists)
        {
            return BadRequest("ClientId invalide.");
        }

        var fournisseurExists = await _context.Fournisseurs.AnyAsync(x => x.Id == dto.FournisseurId);
        if (!fournisseurExists)
        {
            return BadRequest("FournisseurId invalide.");
        }

        var emplacementExists = await _context.Emplacements.AnyAsync(x => x.Id == dto.EmplacementId);
        if (!emplacementExists)
        {
            return BadRequest("EmplacementId invalide.");
        }

        var exists = await _context.Outils.AnyAsync(o =>
            o.CodeOutillage == codeOutillage || o.OTT == ott);

        if (exists)
        {
            return BadRequest("Un outil avec ce code outillage ou cet OTT existe déjà.");
        }

        var item = new Outil
        {
            LigneId = dto.LigneId,
            ClientId = dto.ClientId,
            FournisseurId = dto.FournisseurId,
            EmplacementId = dto.EmplacementId,
            OTT = ott,
            CodeOutillage = codeOutillage,
            Status = status,
            Valeur = dto.Valeur,
            JustificationHS = justificationHS,
            DateAffectation = dto.DateAffectation
        };

        _context.Outils.Add(item);
        await _context.SaveChangesAsync();

        var result = await _context.Outils
            .Include(o => o.Ligne)
            .Include(o => o.Client)
            .Include(o => o.Fournisseur)
            .Include(o => o.Emplacement)
            .Where(o => o.Id == item.Id)
            .Select(o => new OutilDto
            {
                Id = o.Id,
                LigneId = o.LigneId,
                LigneName = o.Ligne != null ? o.Ligne.Nom : "",
                ClientId = o.ClientId,
                ClientName = o.Client != null ? o.Client.NomClient : "",
                FournisseurId = o.FournisseurId,
                FournisseurName = o.Fournisseur != null ? o.Fournisseur.NomFournisseur : "",
                EmplacementId = o.EmplacementId,
                EmplacementLabel = o.Emplacement != null ? (o.Emplacement.Armoire + " - " + o.Emplacement.Numero) : "",
                OTT = o.OTT,
                CodeOutillage = o.CodeOutillage,
                Status = o.Status,
                Valeur = o.Valeur,
                JustificationHS = o.JustificationHS,
                DateAffectation = o.DateAffectation
            })
            .FirstAsync();

        await _archiveService.AddAsync(
            action: "CREATE",
            entityName: "Outil",
            entityId: item.Id,
            description: $"Ajout de l’outil : {item.CodeOutillage}",
            oldValues: null,
            newValues: result
        );

        return CreatedAtAction(nameof(GetById), new { id = item.Id }, result);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    public async Task<IActionResult> Update(int id, UpdateOutilDto dto)
    {
        var item = await _context.Outils
            .Include(o => o.Ligne)
            .Include(o => o.Client)
            .Include(o => o.Fournisseur)
            .Include(o => o.Emplacement)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (item == null)
        {
            return NotFound("Outil introuvable.");
        }

        if (dto.LigneId <= 0)
        {
            return BadRequest("La ligne est obligatoire.");
        }

        if (dto.ClientId <= 0)
        {
            return BadRequest("Le client est obligatoire.");
        }

        if (dto.FournisseurId <= 0)
        {
            return BadRequest("Le fournisseur est obligatoire.");
        }

        if (dto.EmplacementId <= 0)
        {
            return BadRequest("L’emplacement est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.OTT))
        {
            return BadRequest("L’OTT est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.CodeOutillage))
        {
            return BadRequest("Le code outillage est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.Status))
        {
            return BadRequest("Le statut est obligatoire.");
        }

        var ott = dto.OTT.Trim();
        var codeOutillage = dto.CodeOutillage.Trim();
        var status = dto.Status.Trim();
        var justificationHS = dto.JustificationHS?.Trim();

        if (status == "HS" && string.IsNullOrWhiteSpace(justificationHS))
        {
            return BadRequest("La justification HS est obligatoire lorsque le statut est HS.");
        }

        if (status != "HS")
        {
            justificationHS = "";
        }

        var ligneExists = await _context.Lignes.AnyAsync(x => x.Id == dto.LigneId);
        if (!ligneExists)
        {
            return BadRequest("LigneId invalide.");
        }

        var clientExists = await _context.Clients.AnyAsync(x => x.Id == dto.ClientId);
        if (!clientExists)
        {
            return BadRequest("ClientId invalide.");
        }

        var fournisseurExists = await _context.Fournisseurs.AnyAsync(x => x.Id == dto.FournisseurId);
        if (!fournisseurExists)
        {
            return BadRequest("FournisseurId invalide.");
        }

        var emplacementExists = await _context.Emplacements.AnyAsync(x => x.Id == dto.EmplacementId);
        if (!emplacementExists)
        {
            return BadRequest("EmplacementId invalide.");
        }

        var exists = await _context.Outils.AnyAsync(o =>
            (o.CodeOutillage == codeOutillage || o.OTT == ott) && o.Id != id);

        if (exists)
        {
            return BadRequest("Un autre outil avec ce code outillage ou cet OTT existe déjà.");
        }

        var oldValues = new
        {
            item.Id,
            item.LigneId,
            LigneName = item.Ligne != null ? item.Ligne.Nom : "",
            item.ClientId,
            ClientName = item.Client != null ? item.Client.NomClient : "",
            item.FournisseurId,
            FournisseurName = item.Fournisseur != null ? item.Fournisseur.NomFournisseur : "",
            item.EmplacementId,
            EmplacementLabel = item.Emplacement != null ? (item.Emplacement.Armoire + " - " + item.Emplacement.Numero) : "",
            item.OTT,
            item.CodeOutillage,
            item.Status,
            item.Valeur,
            item.JustificationHS,
            item.DateAffectation
        };

        item.LigneId = dto.LigneId;
        item.ClientId = dto.ClientId;
        item.FournisseurId = dto.FournisseurId;
        item.EmplacementId = dto.EmplacementId;
        item.OTT = ott;
        item.CodeOutillage = codeOutillage;
        item.Status = status;
        item.Valeur = dto.Valeur;
        item.JustificationHS = justificationHS;
        item.DateAffectation = dto.DateAffectation;

        await _context.SaveChangesAsync();

        var updatedItem = await _context.Outils
            .Include(o => o.Ligne)
            .Include(o => o.Client)
            .Include(o => o.Fournisseur)
            .Include(o => o.Emplacement)
            .FirstAsync(o => o.Id == id);

        var newValues = new
        {
            updatedItem.Id,
            updatedItem.LigneId,
            LigneName = updatedItem.Ligne != null ? updatedItem.Ligne.Nom : "",
            updatedItem.ClientId,
            ClientName = updatedItem.Client != null ? updatedItem.Client.NomClient : "",
            updatedItem.FournisseurId,
            FournisseurName = updatedItem.Fournisseur != null ? updatedItem.Fournisseur.NomFournisseur : "",
            updatedItem.EmplacementId,
            EmplacementLabel = updatedItem.Emplacement != null ? (updatedItem.Emplacement.Armoire + " - " + updatedItem.Emplacement.Numero) : "",
            updatedItem.OTT,
            updatedItem.CodeOutillage,
            updatedItem.Status,
            updatedItem.Valeur,
            updatedItem.JustificationHS,
            updatedItem.DateAffectation
        };

        await _archiveService.AddAsync(
            action: "UPDATE",
            entityName: "Outil",
            entityId: item.Id,
            description: $"Modification de l’outil : {item.CodeOutillage}",
            oldValues: oldValues,
            newValues: newValues
        );

        return NoContent();
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _context.Outils
            .Include(o => o.Ligne)
            .Include(o => o.Client)
            .Include(o => o.Fournisseur)
            .Include(o => o.Emplacement)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (item == null)
        {
            return NotFound("Outil introuvable.");
        }

        var oldValues = new
        {
            item.Id,
            item.LigneId,
            LigneName = item.Ligne != null ? item.Ligne.Nom : "",
            item.ClientId,
            ClientName = item.Client != null ? item.Client.NomClient : "",
            item.FournisseurId,
            FournisseurName = item.Fournisseur != null ? item.Fournisseur.NomFournisseur : "",
            item.EmplacementId,
            EmplacementLabel = item.Emplacement != null ? (item.Emplacement.Armoire + " - " + item.Emplacement.Numero) : "",
            item.OTT,
            item.CodeOutillage,
            item.Status,
            item.Valeur,
            item.JustificationHS,
            item.DateAffectation
        };

        _context.Outils.Remove(item);
        await _context.SaveChangesAsync();

        await _archiveService.AddAsync(
            action: "DELETE",
            entityName: "Outil",
            entityId: id,
            description: $"Suppression de l’outil : {oldValues.CodeOutillage}",
            oldValues: oldValues,
            newValues: null
        );

        return NoContent();
    }
}