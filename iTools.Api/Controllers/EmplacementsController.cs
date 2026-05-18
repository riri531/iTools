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
public class EmplacementsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ArchiveService _archiveService;

    public EmplacementsController(
        ApplicationDbContext context,
        ArchiveService archiveService)
    {
        _context = context;
        _archiveService = archiveService;
    }

    [HttpGet]
    [Authorize(Roles = "ADMIN,RESPONSABLE,EMPLOYE")]
    public async Task<ActionResult<IEnumerable<EmplacementDto>>> GetAll()
    {
        var items = await _context.Emplacements
            .Include(e => e.Matiere)
            .Include(e => e.Designation)
            .OrderBy(e => e.Id)
            .Select(e => new EmplacementDto
            {
                Id = e.Id,
                MatiereId = e.MatiereId,
                MatiereName = e.Matiere != null ? e.Matiere.NomMatiere : "",
                Armoire = e.Armoire,
                Numero = e.Numero,
                DesignationId = e.DesignationId,
                DesignationName = e.Designation != null ? e.Designation.Name : "",
                Status = e.Status
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id}")]
    [Authorize(Roles = "ADMIN,RESPONSABLE,EMPLOYE")]
    public async Task<ActionResult<EmplacementDto>> GetById(int id)
    {
        var item = await _context.Emplacements
            .Include(e => e.Matiere)
            .Include(e => e.Designation)
            .Where(e => e.Id == id)
            .Select(e => new EmplacementDto
            {
                Id = e.Id,
                MatiereId = e.MatiereId,
                MatiereName = e.Matiere != null ? e.Matiere.NomMatiere : "",
                Armoire = e.Armoire,
                Numero = e.Numero,
                DesignationId = e.DesignationId,
                DesignationName = e.Designation != null ? e.Designation.Name : "",
                Status = e.Status
            })
            .FirstOrDefaultAsync();

        if (item == null)
        {
            return NotFound("Emplacement introuvable.");
        }

        return Ok(item);
    }

    [HttpPost]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    public async Task<ActionResult<EmplacementDto>> Create(CreateEmplacementDto dto)
    {
        if (dto.MatiereId <= 0)
        {
            return BadRequest("La matière est obligatoire.");
        }

        if (dto.DesignationId <= 0)
        {
            return BadRequest("La désignation est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.Armoire))
        {
            return BadRequest("L’armoire est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.Numero))
        {
            return BadRequest("Le numéro est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.Status))
        {
            return BadRequest("Le statut est obligatoire.");
        }

        var armoire = dto.Armoire.Trim();
        var numero = dto.Numero.Trim();
        var status = dto.Status.Trim();

        var matiereExists = await _context.Matieres.AnyAsync(m => m.Id == dto.MatiereId);
        if (!matiereExists)
        {
            return BadRequest("MatiereId invalide.");
        }

        var designationExists = await _context.Designations.AnyAsync(d => d.Id == dto.DesignationId);
        if (!designationExists)
        {
            return BadRequest("DesignationId invalide.");
        }

        var exists = await _context.Emplacements.AnyAsync(e =>
            e.MatiereId == dto.MatiereId &&
            e.Armoire == armoire &&
            e.Numero == numero &&
            e.DesignationId == dto.DesignationId);

        if (exists)
        {
            return BadRequest("Cet emplacement existe déjà.");
        }

        var item = new Emplacement
        {
            MatiereId = dto.MatiereId,
            Armoire = armoire,
            Numero = numero,
            DesignationId = dto.DesignationId,
            Status = status
        };

        _context.Emplacements.Add(item);
        await _context.SaveChangesAsync();

        var result = await _context.Emplacements
            .Include(e => e.Matiere)
            .Include(e => e.Designation)
            .Where(e => e.Id == item.Id)
            .Select(e => new EmplacementDto
            {
                Id = e.Id,
                MatiereId = e.MatiereId,
                MatiereName = e.Matiere != null ? e.Matiere.NomMatiere : "",
                Armoire = e.Armoire,
                Numero = e.Numero,
                DesignationId = e.DesignationId,
                DesignationName = e.Designation != null ? e.Designation.Name : "",
                Status = e.Status
            })
            .FirstAsync();

        await _archiveService.AddAsync(
            action: "CREATE",
            entityName: "Emplacement",
            entityId: item.Id,
            description: $"Ajout de l’emplacement : {item.Armoire}-{item.Numero}",
            oldValues: null,
            newValues: result
        );

        return CreatedAtAction(nameof(GetById), new { id = item.Id }, result);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    public async Task<IActionResult> Update(int id, UpdateEmplacementDto dto)
    {
        var item = await _context.Emplacements
            .Include(e => e.Matiere)
            .Include(e => e.Designation)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (item == null)
        {
            return NotFound("Emplacement introuvable.");
        }

        if (dto.MatiereId <= 0)
        {
            return BadRequest("La matière est obligatoire.");
        }

        if (dto.DesignationId <= 0)
        {
            return BadRequest("La désignation est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.Armoire))
        {
            return BadRequest("L’armoire est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.Numero))
        {
            return BadRequest("Le numéro est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.Status))
        {
            return BadRequest("Le statut est obligatoire.");
        }

        var armoire = dto.Armoire.Trim();
        var numero = dto.Numero.Trim();
        var status = dto.Status.Trim();

        var matiereExists = await _context.Matieres.AnyAsync(m => m.Id == dto.MatiereId);
        if (!matiereExists)
        {
            return BadRequest("MatiereId invalide.");
        }

        var designationExists = await _context.Designations.AnyAsync(d => d.Id == dto.DesignationId);
        if (!designationExists)
        {
            return BadRequest("DesignationId invalide.");
        }

        var exists = await _context.Emplacements.AnyAsync(e =>
            e.MatiereId == dto.MatiereId &&
            e.Armoire == armoire &&
            e.Numero == numero &&
            e.DesignationId == dto.DesignationId &&
            e.Id != id);

        if (exists)
        {
            return BadRequest("Cet emplacement existe déjà.");
        }

        var oldValues = new
        {
            item.Id,
            item.MatiereId,
            MatiereName = item.Matiere != null ? item.Matiere.NomMatiere : "",
            item.Armoire,
            item.Numero,
            item.DesignationId,
            DesignationName = item.Designation != null ? item.Designation.Name : "",
            item.Status
        };

        item.MatiereId = dto.MatiereId;
        item.Armoire = armoire;
        item.Numero = numero;
        item.DesignationId = dto.DesignationId;
        item.Status = status;

        await _context.SaveChangesAsync();

        var updatedItem = await _context.Emplacements
            .Include(e => e.Matiere)
            .Include(e => e.Designation)
            .FirstAsync(e => e.Id == id);

        var newValues = new
        {
            updatedItem.Id,
            updatedItem.MatiereId,
            MatiereName = updatedItem.Matiere != null ? updatedItem.Matiere.NomMatiere : "",
            updatedItem.Armoire,
            updatedItem.Numero,
            updatedItem.DesignationId,
            DesignationName = updatedItem.Designation != null ? updatedItem.Designation.Name : "",
            updatedItem.Status
        };

        await _archiveService.AddAsync(
            action: "UPDATE",
            entityName: "Emplacement",
            entityId: item.Id,
            description: $"Modification de l’emplacement : {item.Armoire}-{item.Numero}",
            oldValues: oldValues,
            newValues: newValues
        );

        return NoContent();
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _context.Emplacements
            .Include(e => e.Matiere)
            .Include(e => e.Designation)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (item == null)
        {
            return NotFound("Emplacement introuvable.");
        }

        var oldValues = new
        {
            item.Id,
            item.MatiereId,
            MatiereName = item.Matiere != null ? item.Matiere.NomMatiere : "",
            item.Armoire,
            item.Numero,
            item.DesignationId,
            DesignationName = item.Designation != null ? item.Designation.Name : "",
            item.Status
        };

        _context.Emplacements.Remove(item);
        await _context.SaveChangesAsync();

        await _archiveService.AddAsync(
            action: "DELETE",
            entityName: "Emplacement",
            entityId: id,
            description: $"Suppression de l’emplacement : {oldValues.Armoire}-{oldValues.Numero}",
            oldValues: oldValues,
            newValues: null
        );

        return NoContent();
    }
}