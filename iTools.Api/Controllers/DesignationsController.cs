using iTools.Api.Data;
using iTools.Api.Models;
using iTools.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iTools.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class DesignationsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ArchiveService _archiveService;

        public DesignationsController(
            ApplicationDbContext context,
            ArchiveService archiveService)
        {
            _context = context;
            _archiveService = archiveService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Designation>>> GetAll()
        {
            var designations = await _context.Designations
                .OrderBy(d => d.Id)
                .ToListAsync();

            return Ok(designations);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Designation>> GetById(int id)
        {
            var designation = await _context.Designations.FindAsync(id);

            if (designation == null)
            {
                return NotFound("Désignation introuvable.");
            }

            return Ok(designation);
        }

        [HttpPost]
        public async Task<ActionResult<Designation>> Create(Designation designation)
        {
            if (string.IsNullOrWhiteSpace(designation.Name))
            {
                return BadRequest("Le nom de la désignation est obligatoire.");
            }

            designation.Name = designation.Name.Trim();

            var exists = await _context.Designations
                .AnyAsync(d => d.Name == designation.Name);

            if (exists)
            {
                return BadRequest("Cette désignation existe déjà.");
            }

            _context.Designations.Add(designation);
            await _context.SaveChangesAsync();

            await _archiveService.AddAsync(
                action: "CREATE",
                entityName: "Designation",
                entityId: designation.Id,
                description: $"Ajout de la désignation : {designation.Name}",
                oldValues: null,
                newValues: designation
            );

            return CreatedAtAction(nameof(GetById), new { id = designation.Id }, designation);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, Designation updatedDesignation)
        {
            var designation = await _context.Designations.FindAsync(id);

            if (designation == null)
            {
                return NotFound("Désignation introuvable.");
            }

            if (string.IsNullOrWhiteSpace(updatedDesignation.Name))
            {
                return BadRequest("Le nom de la désignation est obligatoire.");
            }

            updatedDesignation.Name = updatedDesignation.Name.Trim();

            var exists = await _context.Designations
                .AnyAsync(d => d.Name == updatedDesignation.Name && d.Id != id);

            if (exists)
            {
                return BadRequest("Cette désignation existe déjà.");
            }

            var oldValues = new
            {
                designation.Id,
                designation.Name
            };

            designation.Name = updatedDesignation.Name;

            await _context.SaveChangesAsync();

            var newValues = new
            {
                designation.Id,
                designation.Name
            };

            await _archiveService.AddAsync(
                action: "UPDATE",
                entityName: "Designation",
                entityId: designation.Id,
                description: $"Modification de la désignation : {designation.Name}",
                oldValues: oldValues,
                newValues: newValues
            );

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var designation = await _context.Designations.FindAsync(id);

            if (designation == null)
            {
                return NotFound("Désignation introuvable.");
            }

            var oldValues = new
            {
                designation.Id,
                designation.Name
            };

            _context.Designations.Remove(designation);
            await _context.SaveChangesAsync();

            await _archiveService.AddAsync(
                action: "DELETE",
                entityName: "Designation",
                entityId: id,
                description: $"Suppression de la désignation : {oldValues.Name}",
                oldValues: oldValues,
                newValues: null
            );

            return NoContent();
        }
    }
}