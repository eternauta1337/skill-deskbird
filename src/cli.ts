#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import { format, addDays, parseISO, isValid, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

import { loadConfig } from './config.js';
import { DeskbirdClient, DeskbirdAPIError } from './api.js';
import type { Booking, Resource, ResourceType, Config } from './types.js';

let config: Config | null = null;
let client: DeskbirdClient | null = null;

function getClient(): DeskbirdClient {
  if (!client) {
    config = loadConfig();
    client = new DeskbirdClient(config);
  }
  return client;
}

function getConfig(): Config {
  if (!config) {
    config = loadConfig();
    client = new DeskbirdClient(config);
  }
  return config;
}

// ============ Helpers ============

function parseDate(dateStr: string | undefined): string {
  if (!dateStr || dateStr === 'hoy' || dateStr === 'today') {
    return format(new Date(), 'yyyy-MM-dd');
  }
  if (dateStr === 'mañana' || dateStr === 'manana' || dateStr === 'tomorrow') {
    return format(addDays(new Date(), 1), 'yyyy-MM-dd');
  }

  const parsed = parseISO(dateStr);
  if (isValid(parsed)) {
    return format(parsed, 'yyyy-MM-dd');
  }

  // Try DD/MM or DD/MM/YYYY
  const parts = dateStr.split('/');
  if (parts.length >= 2) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parts[2] ? parseInt(parts[2], 10) : new Date().getFullYear();
    const date = new Date(year, month, day);
    if (isValid(date)) {
      return format(date, 'yyyy-MM-dd');
    }
  }

  throw new Error(`Invalid date: ${dateStr}. Use YYYY-MM-DD, DD/MM or DD/MM/YYYY`);
}

function parseTime(timeStr: string | undefined): string | undefined {
  if (!timeStr) return undefined;

  // Handle "19hs", "19h", "19"
  const numMatch = timeStr.match(/^(\d{1,2})(?:hs?)?$/i);
  if (numMatch) {
    const hour = parseInt(numMatch[1], 10);
    if (hour >= 0 && hour <= 23) {
      return `${hour.toString().padStart(2, '0')}:00`;
    }
  }

  // Handle "HH:MM"
  const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1], 10);
    const min = parseInt(timeMatch[2], 10);
    if (hour >= 0 && hour <= 23 && min >= 0 && min <= 59) {
      return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    }
  }

  throw new Error(`Invalid time: ${timeStr}. Use HH:MM, HH or HHhs`);
}

function formatDate(date: string): string {
  return format(parseISO(date), "EEEE d 'de' MMMM", { locale: es });
}

function formatTime(isoDateTime: string): string {
  return isoDateTime.split('T')[1]?.substring(0, 5) || '';
}

function getResourceIcon(type: ResourceType): string {
  switch (type) {
    case 'flexDesk': return '🪑';
    case 'meetingRoom': return '🚪';
    case 'parking': return '🚗';
    default: return '📍';
  }
}

function getCurrentUser(): { id: string; name: string } {
  return {
    id: process.env.OPENCLAW_USER_ID || process.env.DESKBIRD_USER_ID || process.env.USER || 'unknown',
    name: process.env.OPENCLAW_USER_NAME || process.env.DESKBIRD_USER_NAME || process.env.USER || 'User',
  };
}

function handleError(err: unknown): never {
  if (err instanceof DeskbirdAPIError) {
    console.error(chalk.red(`Error ${err.statusCode}: ${err.message}`));
    if (err.response) {
      console.error(chalk.gray(JSON.stringify(err.response, null, 2)));
    }
  } else if (err instanceof Error) {
    console.error(chalk.red(`Error: ${err.message}`));
  } else {
    console.error(chalk.red('Unknown error'));
  }
  process.exit(1);
}

// ============ CLI ============

program
  .name('deskbird')
  .description('Deskbird integration - desk booking and office management')
  .version('0.1.0');

// List resources and their availability
program
  .command('list')
  .alias('ls')
  .description('List resources and availability')
  .option('-d, --date <date>', 'Date (default: today)')
  .option('-o, --office <id>', 'Office ID')
  .option('-t, --type <type>', 'Resource type: flexDesk, meetingRoom, parking')
  .action(async (options) => {
    try {
      const date = parseDate(options.date);
      const officeId = options.office || getConfig().defaultOfficeId;

      console.log(chalk.bold(`\n📅 Resources for ${formatDate(date)}\n`));

      // Get resources
      const resources = await getClient().listResources({
        officeId,
        type: options.type as ResourceType | undefined,
      });

      // Get bookings for the date
      const bookings = await getClient().listBookings({
        startDate: date,
        endDate: date,
        officeId,
      });

      // Group resources by type
      const byType = new Map<ResourceType, Resource[]>();
      for (const resource of resources) {
        const list = byType.get(resource.type) || [];
        list.push(resource);
        byType.set(resource.type, list);
      }

      // Display each type
      for (const [type, typeResources] of byType) {
        console.log(chalk.bold(`${getResourceIcon(type)} ${type}`));

        for (const resource of typeResources) {
          const resourceBookings = bookings.filter(b => b.resourceId === resource.id);

          if (resourceBookings.length > 0) {
            const slots = resourceBookings.map(b => {
              const start = formatTime(b.startTime);
              const end = formatTime(b.endTime);
              const user = b.user ? `${b.user.firstName} ${b.user.lastName}` : 'Reserved';
              return `${start}-${end} ${user}`;
            }).join(', ');
            console.log(chalk.red(`  ❌ ${resource.name}: ${slots}`));
          } else {
            console.log(chalk.green(`  ✅ ${resource.name}: Available`));
          }
        }
        console.log();
      }
    } catch (err) {
      handleError(err);
    }
  });

// Book a resource
program
  .command('book <resource>')
  .alias('reservar')
  .description('Book a resource (desk, room, parking)')
  .option('-d, --date <date>', 'Date (default: today)')
  .option('-s, --start <time>', 'Start time (default: 09:00)')
  .option('-e, --end <time>', 'End time (default: 18:00)')
  .option('-o, --office <id>', 'Office ID')
  .action(async (resourceArg, options) => {
    try {
      const date = parseDate(options.date);
      const officeId = options.office || getConfig().defaultOfficeId;
      const startTime = parseTime(options.start) || '09:00';
      const endTime = parseTime(options.end) || '18:00';
      const currentUser = getCurrentUser();

      // Find the resource
      const resources = await getClient().listResources({ officeId });
      const resource = resources.find(
        r => r.id === resourceArg ||
             r.name.toLowerCase() === resourceArg.toLowerCase() ||
             r.name.toLowerCase().includes(resourceArg.toLowerCase())
      );

      if (!resource) {
        console.error(chalk.red(`Resource "${resourceArg}" not found.`));
        console.error(chalk.gray(`Available resources: ${resources.map(r => r.name).join(', ')}`));
        process.exit(1);
      }

      console.log(chalk.cyan(`Booking ${resource.name} for ${date} (${startTime}-${endTime})...`));

      const startDateTime = `${date}T${startTime}:00.000Z`;
      const endDateTime = `${date}T${endTime}:00.000Z`;

      const booking = await getClient().createBooking({
        userId: currentUser.id,
        resourceId: resource.id,
        startTime: startDateTime,
        endTime: endDateTime,
      });

      console.log(chalk.green(`\n✅ Booking confirmed: ${resource.name} for ${date} (${startTime}-${endTime})\n`));
      console.log(chalk.gray(`Booking ID: ${booking.id}`));
    } catch (err) {
      handleError(err);
    }
  });

// Cancel a booking
program
  .command('cancel <resource>')
  .aliases(['release', 'liberar', 'cancelar'])
  .description('Cancel a booking')
  .option('-d, --date <date>', 'Date (default: today)')
  .option('-o, --office <id>', 'Office ID')
  .action(async (resourceArg, options) => {
    try {
      const date = parseDate(options.date);
      const officeId = options.office || getConfig().defaultOfficeId;
      const currentUser = getCurrentUser();

      // Find the resource
      const resources = await getClient().listResources({ officeId });
      const resource = resources.find(
        r => r.id === resourceArg ||
             r.name.toLowerCase() === resourceArg.toLowerCase() ||
             r.name.toLowerCase().includes(resourceArg.toLowerCase())
      );

      if (!resource) {
        console.error(chalk.red(`Resource "${resourceArg}" not found.`));
        process.exit(1);
      }

      // Find the booking
      const bookings = await getClient().listBookings({
        startDate: date,
        endDate: date,
        resourceId: resource.id,
        userId: currentUser.id,
      });

      if (bookings.length === 0) {
        console.log(chalk.yellow(`\n⚠️  No booking found for ${resource.name} on ${date}\n`));
        process.exit(1);
      }

      const booking = bookings[0];
      console.log(chalk.cyan(`Cancelling booking for ${resource.name} on ${date}...`));

      await getClient().cancelBooking(booking.id);

      console.log(chalk.green(`\n✅ Booking cancelled: ${resource.name} for ${date}\n`));
    } catch (err) {
      handleError(err);
    }
  });

// My bookings
program
  .command('my')
  .alias('mis')
  .description('Show my bookings')
  .option('-d, --days <n>', 'Days ahead to show (default: 14)', '14')
  .action(async (options) => {
    try {
      const currentUser = getCurrentUser();
      const today = format(new Date(), 'yyyy-MM-dd');
      const endDate = format(addDays(new Date(), parseInt(options.days, 10)), 'yyyy-MM-dd');

      const bookings = await getClient().listBookings({
        startDate: today,
        endDate,
        userId: currentUser.id,
      });

      console.log(chalk.bold(`\n📋 My bookings\n`));

      if (bookings.length === 0) {
        console.log(chalk.gray('  No upcoming bookings.\n'));
        return;
      }

      // Group by date
      const byDate = new Map<string, Booking[]>();
      for (const booking of bookings) {
        const date = booking.startTime.split('T')[0];
        const list = byDate.get(date) || [];
        list.push(booking);
        byDate.set(date, list);
      }

      for (const [date, dateBookings] of byDate) {
        console.log(chalk.bold(`  ${formatDate(date)}`));
        for (const booking of dateBookings) {
          const start = formatTime(booking.startTime);
          const end = formatTime(booking.endTime);
          const resourceName = booking.resource?.name || booking.resourceId;
          const icon = booking.resource ? getResourceIcon(booking.resource.type) : '📍';
          console.log(chalk.cyan(`    ${icon} ${resourceName}: ${start}-${end}`));
        }
      }
      console.log();
    } catch (err) {
      handleError(err);
    }
  });

// Status - today and tomorrow
program
  .command('status')
  .description('Show today and tomorrow summary')
  .option('-o, --office <id>', 'Office ID')
  .action(async (options) => {
    try {
      const officeId = options.office || getConfig().defaultOfficeId;
      const today = format(new Date(), 'yyyy-MM-dd');
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      const api = getClient();
      const [todayBookings, tomorrowBookings, resources] = await Promise.all([
        api.listBookings({ startDate: today, endDate: today, officeId }),
        api.listBookings({ startDate: tomorrow, endDate: tomorrow, officeId }),
        api.listResources({ officeId, type: 'flexDesk' }),
      ]);

      console.log(chalk.bold('\n📊 Status\n'));

      const showDay = (label: string, bookings: Booking[]) => {
        console.log(chalk.bold(label));
        for (const resource of resources) {
          const resourceBookings = bookings.filter(b => b.resourceId === resource.id);
          if (resourceBookings.length > 0) {
            const slots = resourceBookings.map(b => {
              const start = formatTime(b.startTime);
              const end = formatTime(b.endTime);
              const user = b.user ? `${b.user.firstName}` : '';
              return `${start}-${end} ${user}`.trim();
            }).join(', ');
            console.log(chalk.red(`  ${resource.name}: ${slots}`));
          } else {
            console.log(chalk.green(`  ${resource.name}: Free`));
          }
        }
      };

      showDay('Today:', todayBookings);
      console.log();
      showDay('Tomorrow:', tomorrowBookings);
      console.log();
    } catch (err) {
      handleError(err);
    }
  });

// Check in
program
  .command('checkin [resource]')
  .description('Check in to a booking')
  .option('-d, --date <date>', 'Date (default: today)')
  .option('-o, --office <id>', 'Office ID')
  .action(async (resourceArg, options) => {
    try {
      const date = parseDate(options.date);
      const officeId = options.office || getConfig().defaultOfficeId;
      const currentUser = getCurrentUser();

      // Get my bookings for today
      let bookings = await getClient().listBookings({
        startDate: date,
        endDate: date,
        userId: currentUser.id,
        officeId,
      });

      // Filter by resource if specified
      if (resourceArg) {
        const resources = await getClient().listResources({ officeId });
        const resource = resources.find(
          r => r.id === resourceArg ||
               r.name.toLowerCase() === resourceArg.toLowerCase() ||
               r.name.toLowerCase().includes(resourceArg.toLowerCase())
        );
        if (resource) {
          bookings = bookings.filter(b => b.resourceId === resource.id);
        }
      }

      if (bookings.length === 0) {
        console.log(chalk.yellow(`\n⚠️  No booking found for today\n`));
        process.exit(1);
      }

      const booking = bookings[0];
      console.log(chalk.cyan(`Checking in to ${booking.resource?.name || booking.resourceId}...`));

      await getClient().checkIn(booking.id);

      console.log(chalk.green(`\n✅ Checked in!\n`));
    } catch (err) {
      handleError(err);
    }
  });

// Offices
program
  .command('offices')
  .description('List available offices')
  .action(async () => {
    try {
      const offices = await getClient().listOffices();

      console.log(chalk.bold('\n🏢 Offices\n'));

      for (const office of offices) {
        const isDefault = office.id === getConfig().defaultOfficeId ? chalk.cyan(' (default)') : '';
        console.log(`  ${office.name}${isDefault}`);
        console.log(chalk.gray(`    ID: ${office.id}`));
      }
      console.log();
    } catch (err) {
      handleError(err);
    }
  });

// Resources
program
  .command('resources')
  .description('List all resources')
  .option('-o, --office <id>', 'Office ID')
  .option('-t, --type <type>', 'Resource type: flexDesk, meetingRoom, parking')
  .action(async (options) => {
    try {
      const officeId = options.office || getConfig().defaultOfficeId;
      const resources = await getClient().listResources({
        officeId,
        type: options.type as ResourceType | undefined,
      });

      console.log(chalk.bold('\n📋 Resources\n'));

      // Group by type
      const byType = new Map<ResourceType, Resource[]>();
      for (const resource of resources) {
        const list = byType.get(resource.type) || [];
        list.push(resource);
        byType.set(resource.type, list);
      }

      for (const [type, typeResources] of byType) {
        console.log(chalk.bold(`${getResourceIcon(type)} ${type} (${typeResources.length})`));
        for (const resource of typeResources) {
          console.log(`  ${resource.name}`);
          console.log(chalk.gray(`    ID: ${resource.id}`));
        }
        console.log();
      }
    } catch (err) {
      handleError(err);
    }
  });

program.parse();
