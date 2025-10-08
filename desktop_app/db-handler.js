const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { execSync } = require('child_process');
const { app } = require('electron');

// Paths
const CHAT_DB_PATH = path.join(process.env.HOME, 'Library', 'Messages', 'chat.db');
const CONTACTS_DB_PATH = path.join(process.env.HOME, 'Library', 'Application Support', 'AddressBook', 'Sources');

// Use Electron's userData directory in built app, or __dirname in development
const APP_DATA_DIR = app && app.getPath ? 
  path.join(app.getPath('userData'), 'chatdata') : 
  path.join(__dirname, 'chatdata');

const CLONE_DB_PATH = path.join(APP_DATA_DIR, 'chat_clone.db');
const CONTACTS_CLONE_PATH = path.join(APP_DATA_DIR, 'contacts_clone.db');
const CONTACTS_CSV_PATH = path.join(APP_DATA_DIR, 'contacts.csv');

// Numbers to exclude from all queries  
// Keep one dummy value to ensure SQL queries are always valid
const EXCLUDED_NUMBERS = ['__DUMMY_NEVER_MATCH__'];

/**
 * Helper to build exclusion clause for SQL queries
 * Returns { clause, params } where clause is the SQL fragment and params are the values
 */
function buildExclusionClause() {
  if (EXCLUDED_NUMBERS.length === 0) {
    return { clause: '', params: [] };
  }
  const placeholders = EXCLUDED_NUMBERS.map(() => '?').join(',');
  return { 
    clause: `AND handle.id NOT IN (${placeholders})`,
    params: EXCLUDED_NUMBERS 
  };
}

/**
 * Helper to build AND clause for excluding numbers in contact queries
 * Returns { clause, params } for use after WHERE handle.id = ?
 */
function buildContactExclusionClause() {
  if (EXCLUDED_NUMBERS.length === 0) {
    return { clause: '', params: [] };
  }
  const conditions = EXCLUDED_NUMBERS.map(() => `handle.id != ?`).join(' AND ');
  return {
    clause: `AND ${conditions}`,
    params: EXCLUDED_NUMBERS
  };
}

/**
 * Check if Full Disk Access is granted by trying to access chat.db
 */
function checkFullDiskAccess() {
  try {
    fs.accessSync(CHAT_DB_PATH, fs.constants.R_OK);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Create a clone of the chat.db file
 */
function cloneChatDatabase(skipContacts = false) {
  try {
    // Create chatdata directory if it doesn't exist
    if (!fs.existsSync(APP_DATA_DIR)) {
      fs.mkdirSync(APP_DATA_DIR, { recursive: true });
    }

    // Delete old clone if it exists to ensure it's not locked
    if (fs.existsSync(CLONE_DB_PATH)) {
      try {
        fs.unlinkSync(CLONE_DB_PATH);
      } catch (err) {
        console.error('Could not delete old clone:', err.message);
        // Try to continue anyway
      }
    }

    // Copy the database file
    fs.copyFileSync(CHAT_DB_PATH, CLONE_DB_PATH);
    
    // Also try to clone contacts database (only on initial setup, not on refresh)
    if (!skipContacts) {
      cloneContactsDatabase();
    }
    
    return true;
  } catch (error) {
    console.error('Failed to clone chat.db:', error);
    return false;
  }
}

/**
 * Find and clone the contacts database
 */
function cloneContactsDatabase() {
  try {
    // Find the AddressBook database (it's in a subdirectory with UUID)
    if (!fs.existsSync(CONTACTS_DB_PATH)) {
      console.log('⚠️  Contacts directory not found at:', CONTACTS_DB_PATH);
      return false;
    }

    // Find all AddressBook-v22.abcddb files
    const sources = fs.readdirSync(CONTACTS_DB_PATH);
    let contactsFound = false;

    console.log('📂 Searching for contacts database in', sources.length, 'sources...');

    for (const source of sources) {
      const sourcePath = path.join(CONTACTS_DB_PATH, source);
      try {
        const stats = fs.statSync(sourcePath);
        if (!stats.isDirectory()) continue;

        const dbPath = path.join(sourcePath, 'AddressBook-v22.abcddb');
        console.log('   Checking:', dbPath);
        
        if (fs.existsSync(dbPath)) {
          // Check if we can read it
          fs.accessSync(dbPath, fs.constants.R_OK);
          fs.copyFileSync(dbPath, CONTACTS_CLONE_PATH);
          console.log('✅ Successfully cloned contacts database from:', source);
          contactsFound = true;
          break;
        }
      } catch (err) {
        console.log('   ⚠️  Cannot access source:', source, '-', err.message);
        continue;
      }
    }

    if (!contactsFound) {
      console.log('⚠️  Contacts database not found in any source directory');
      console.log('   This is normal - contacts matching will be skipped');
    }

    return contactsFound;
  } catch (error) {
    console.error('⚠️  Could not clone contacts:', error.message);
    console.log('   Contacts matching will be unavailable, but the app will still work!');
    return false;
  }
}

/**
 * Get contact name and photo from phone number or email
 * NOTE: Currently disabled as Contacts database is empty
 */
function getContactInfo(identifier) {
  // Contacts database is empty, skip lookup
  return null;
  
  /* DISABLED - Contacts DB has no data
  try {
    if (!fs.existsSync(CONTACTS_CLONE_PATH)) {
      console.log(`⚠️  Contacts DB not found at: ${CONTACTS_CLONE_PATH}`);
      return null;
    }

    const db = new Database(CONTACTS_CLONE_PATH, { readonly: true });
    console.log(`🔍 Looking up contact for: ${identifier}`);
    
    // Check if it's an email
    if (identifier.includes('@')) {
      const emailQuery = `
        SELECT 
          r.ZFIRSTNAME as firstName,
          r.ZLASTNAME as lastName,
          r.ZORGANIZATION as organization,
          r.ZIMAGEDATA as imageData
        FROM ZABCDRECORD r
        LEFT JOIN ZABCDEMAILADDRESS e ON e.ZOWNER = r.Z_PK
        WHERE LOWER(e.ZADDRESS) = LOWER(?)
        LIMIT 1
      `;
      const result = db.prepare(emailQuery).get(identifier);
      db.close();
      
      if (result) {
        return formatContactResult(result);
      }
      return null;
    }
    
    // Clean up phone number (remove all non-digits)
    const digitsOnly = identifier.replace(/\D/g, '');
    
    // Try multiple variations of the phone number
    const variations = [
      digitsOnly,                              // e.g., 5195206158
      digitsOnly.slice(-10),                   // Last 10 digits
      '+1' + digitsOnly.slice(-10),           // +1 prefix
      '1' + digitsOnly.slice(-10),            // 1 prefix
    ];
    
    // Also try the original format
    if (digitsOnly !== identifier) {
      variations.push(identifier);
    }
    
    console.log(`   Trying variations:`, variations.slice(0, 3).join(', '));
    
    // First, let's see what phone numbers are in the database
    const samplePhones = db.prepare(`
      SELECT ZFULLNUMBER FROM ZABCDPHONENUMBER LIMIT 5
    `).all();
    console.log(`   Sample phone formats in DB:`, samplePhones.map(p => p.ZFULLNUMBER));
    
    // Query for phone numbers - try all variations
    const phoneQuery = `
      SELECT 
        r.ZFIRSTNAME as firstName,
        r.ZLASTNAME as lastName,
        r.ZORGANIZATION as organization,
        r.ZIMAGEDATA as imageData
      FROM ZABCDRECORD r
      LEFT JOIN ZABCDPHONENUMBER p ON p.ZOWNER = r.Z_PK
      WHERE p.ZFULLNUMBER LIKE ?
      LIMIT 1
    `;
    
    for (const variation of variations) {
      const result = db.prepare(phoneQuery).get(`%${variation}%`);
      if (result) {
        console.log(`   ✅ MATCH FOUND with variation: ${variation}`);
        db.close();
        return formatContactResult(result);
      } else {
        console.log(`   ❌ No match for: ${variation}`);
      }
    }
    
    console.log(`   ❌ No match found for ${identifier}`);
    db.close();
    return null;
  } catch (error) {
    console.error('❌ Error getting contact info for', identifier, ':', error);
    return null;
  }
  */
}

/**
 * Format contact query result into standardized object
 */
function formatContactResult(result) {
  const firstName = result.firstName || '';
  const lastName = result.lastName || '';
  const organization = result.organization || '';
  
  const displayName = firstName && lastName 
    ? `${firstName} ${lastName}`
    : firstName || lastName || organization || null;
  
  return {
    name: displayName,
    firstName: firstName,
    lastName: lastName,
    organization: organization,
    hasPhoto: !!result.imageData,
    imageData: result.imageData
  };
}

/**
 * Get total message count (excluding filtered numbers and group chats)
 */
function getTotalMessages() {
  try {
    const db = new Database(CLONE_DB_PATH, { readonly: true });
    const exclusion = buildExclusionClause();
    const query = `
      SELECT COUNT(DISTINCT message.ROWID) as count
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat_handle_join ON chat_message_join.chat_id = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE 1=1
        ${exclusion.clause}
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND chat_message_join.chat_id IN (
          SELECT chat_id 
          FROM chat_handle_join 
          GROUP BY chat_id 
          HAVING COUNT(handle_id) = 1
        )
    `;
    const result = db.prepare(query).get(...exclusion.params);
    db.close();
    return result.count;
  } catch (error) {
    console.error('Error getting total messages:', error);
    return 0;
  }
}

/**
 * Get messages by year (excluding filtered numbers and group chats)
 */
function getMessagesByYear() {
  try {
    const db = new Database(CLONE_DB_PATH, { readonly: true });
    
    const placeholders = EXCLUDED_NUMBERS.map(() => '?').join(',');
    // iMessage stores dates as seconds since 2001-01-01
    const query = `
      SELECT 
        CAST(strftime('%Y', datetime(message.date/1000000000 + 978307200, 'unixepoch', 'localtime')) AS INTEGER) as year,
        COUNT(DISTINCT message.ROWID) as count
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat_handle_join ON chat_message_join.chat_id = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE message.date IS NOT NULL 
        AND handle.id NOT IN (${placeholders})
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND chat_message_join.chat_id IN (
          SELECT chat_id 
          FROM chat_handle_join 
          GROUP BY chat_id 
          HAVING COUNT(handle_id) = 1
        )
      GROUP BY year
      ORDER BY year ASC
    `;
    
    const results = db.prepare(query).all(...EXCLUDED_NUMBERS);
    db.close();
    
    return results;
  } catch (error) {
    console.error('Error getting messages by year:', error);
    return [];
  }
}

/**
 * Get top contacts by message count with contact info (excluding filtered numbers and group chats)
 */
function getTopContacts(limit = null) {
  try {
    const db = new Database(CLONE_DB_PATH, { readonly: true });
    
    const placeholders = EXCLUDED_NUMBERS.map(() => '?').join(',');
    
    // Build query with optional limit - simple, no contact names
    let query = `
      SELECT 
        handle.id as contact,
        COUNT(DISTINCT message.ROWID) as message_count
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat_handle_join ON chat_message_join.chat_id = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE handle.id IS NOT NULL 
        AND handle.id != '' 
        AND handle.id NOT IN (${placeholders})
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND chat_message_join.chat_id IN (
          SELECT chat_id 
          FROM chat_handle_join 
          GROUP BY chat_id 
          HAVING COUNT(handle_id) = 1
        )
      GROUP BY handle.id
      ORDER BY message_count DESC
    `;
    
    // Add limit only if specified
    if (limit) {
      query += ` LIMIT ?`;
      var results = db.prepare(query).all(...EXCLUDED_NUMBERS, limit);
    } else {
      var results = db.prepare(query).all(...EXCLUDED_NUMBERS);
    }
    
    db.close();
    
    const enrichedResults = results.map((result, index) => {
      let displayName = result.contact;
      
      // Format phone number nicely
      if (result.contact.match(/^\+?1?(\d{10})$/)) {
        // US/Canada number - format as (XXX) XXX-XXXX
        const cleaned = result.contact.replace(/\D/g, '').slice(-10);
        displayName = `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
      } else if (result.contact.includes('@')) {
        // Email - use as is
        displayName = result.contact;
      }
      
      return {
        ...result,
        contact: result.contact, // Keep original for matching
        displayName: displayName,
        hasPhoto: false,
        imageData: null
      };
    });
    
    console.log(`✅ Enriched ${enrichedResults.length} contacts with contact info`);
    console.log('📊 Sample contacts:', enrichedResults.slice(0, 3).map(c => ({
      displayName: c.displayName,
      messageCount: c.message_count,
      hasPhoto: c.hasPhoto
    })));
    
    return enrichedResults;
  } catch (error) {
    console.error('Error getting top contacts:', error);
    return [];
  }
}

/**
 * Get sent vs received message counts (excluding filtered numbers and group chats)
 */
function getSentVsReceived() {
  try {
    const db = new Database(CLONE_DB_PATH, { readonly: true });
    
    const placeholders = EXCLUDED_NUMBERS.map(() => '?').join(',');
    const query = `
      SELECT 
        CASE WHEN message.is_from_me = 1 THEN 'sent' ELSE 'received' END as type,
        COUNT(DISTINCT message.ROWID) as count
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat_handle_join ON chat_message_join.chat_id = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE handle.id NOT IN (${placeholders})
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND chat_message_join.chat_id IN (
          SELECT chat_id 
          FROM chat_handle_join 
          GROUP BY chat_id 
          HAVING COUNT(handle_id) = 1
        )
      GROUP BY message.is_from_me
    `;
    
    const results = db.prepare(query).all(...EXCLUDED_NUMBERS);
    db.close();
    
    const stats = { sent: 0, received: 0 };
    results.forEach(row => {
      stats[row.type] = row.count;
    });
    
    return stats;
  } catch (error) {
    console.error('Error getting sent vs received:', error);
    return { sent: 0, received: 0 };
  }
}

/**
 * Get the most active year
 */
function getMostActiveYear() {
  try {
    const messagesByYear = getMessagesByYear();
    if (messagesByYear.length === 0) return null;
    
    const mostActive = messagesByYear.reduce((prev, current) => 
      (current.count > prev.count) ? current : prev
    );
    
    return mostActive;
  } catch (error) {
    console.error('Error getting most active year:', error);
    return null;
  }
}

/**
 * Get average messages per day (excluding filtered numbers and group chats)
 */
function getAverageMessagesPerDay() {
  try {
    const db = new Database(CLONE_DB_PATH, { readonly: true });
    
    const placeholders = EXCLUDED_NUMBERS.map(() => '?').join(',');
    const query = `
      SELECT 
        COUNT(DISTINCT message.ROWID) as total_messages,
        COUNT(DISTINCT date(datetime(message.date/1000000000 + 978307200, 'unixepoch', 'localtime'))) as total_days
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat_handle_join ON chat_message_join.chat_id = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE message.date IS NOT NULL 
        AND handle.id NOT IN (${placeholders})
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND chat_message_join.chat_id IN (
          SELECT chat_id 
          FROM chat_handle_join 
          GROUP BY chat_id 
          HAVING COUNT(handle_id) = 1
        )
    `;
    
    const result = db.prepare(query).get(...EXCLUDED_NUMBERS);
    db.close();
    
    if (result.total_days === 0) return 0;
    return Math.round(result.total_messages / result.total_days);
  } catch (error) {
    console.error('Error getting average messages per day:', error);
    return 0;
  }
}

/**
 * Get top group chats ordered by message count
 */
function getTopGroupChats(limit = null) {
  try {
    const db = new Database(CLONE_DB_PATH, { readonly: true });
    
    // Get group chats (where COUNT(handle_id) > 1)
    let query = `
      SELECT 
        chat.ROWID as chat_id,
        chat.display_name,
        chat.chat_identifier,
        COUNT(DISTINCT message.ROWID) as message_count,
        COUNT(DISTINCT handle.id) as participant_count
      FROM chat
      JOIN chat_message_join ON chat.ROWID = chat_message_join.chat_id
      JOIN message ON chat_message_join.message_id = message.ROWID
      JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND chat.ROWID IN (
          SELECT chat_id 
          FROM chat_handle_join 
          GROUP BY chat_id 
          HAVING COUNT(handle_id) > 1
        )
      GROUP BY chat.ROWID
      ORDER BY message_count DESC
    `;
    
    if (limit) {
      query += ` LIMIT ?`;
      var results = db.prepare(query).all(limit);
    } else {
      var results = db.prepare(query).all();
    }
    
    // Enhance results with participant handles
    const enhancedResults = results.map(result => {
      // Get participant handles for this chat
      const participantQuery = `
        SELECT DISTINCT handle.id
        FROM handle
        JOIN chat_handle_join ON handle.ROWID = chat_handle_join.handle_id
        WHERE chat_handle_join.chat_id = ?
        LIMIT 5
      `;
      const participants = db.prepare(participantQuery).all(result.chat_id);
      
      // Only use display_name if it exists and doesn't look like a chat ID
      let displayName = result.display_name;
      if (!displayName || displayName.startsWith('chat')) {
        displayName = null;
      }
      
      return {
        chatId: result.chat_id,
        displayName: displayName,
        messageCount: result.message_count,
        participantCount: result.participant_count,
        participantHandles: participants.map(p => p.id)
      };
    });
    
    db.close();
    
    return enhancedResults;
  } catch (error) {
    console.error('Error getting top group chats:', error);
    return [];
  }
}

/**
 * Get stats for a specific group chat (optionally filtered by year)
 */
function getGroupChatStats(chatId, year = null) {
  try {
    if (!cloneExists()) {
      return null;
    }

    const db = new Database(CLONE_DB_PATH, { readonly: true });
    
    // Build year filter clause
    let yearFilter = '';
    const params = [chatId];
    if (year) {
      yearFilter = ` AND strftime('%Y', datetime(message.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch')) = ?`;
      params.push(year.toString());
    }
    
    // Get total messages in this group chat
    const totalQuery = `
      SELECT COUNT(*) as total
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      WHERE chat_message_join.chat_id = ?
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        ${yearFilter}
    `;
    const total = db.prepare(totalQuery).get(...params);
    
    // Get sent vs received
    const sentReceivedQuery = `
      SELECT 
        SUM(CASE WHEN message.is_from_me = 1 THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN message.is_from_me = 0 THEN 1 ELSE 0 END) as received
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      WHERE chat_message_join.chat_id = ?
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        ${yearFilter}
    `;
    const sentReceived = db.prepare(sentReceivedQuery).get(...params);
    
    // Get first message date (for the year if filtered, otherwise overall)
    const firstMessageQuery = `
      SELECT MIN(message.date) as first_date
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      WHERE chat_message_join.chat_id = ?
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        ${yearFilter}
    `;
    const firstMessage = db.prepare(firstMessageQuery).get(...params);
    
    // Get messages by year for this group chat (always show all years for chart)
    const messagesByYearQuery = `
      SELECT 
        strftime('%Y', datetime(message.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch')) as year,
        COUNT(*) as count
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      WHERE chat_message_join.chat_id = ?
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
      GROUP BY year
      ORDER BY year
    `;
    const messagesByYear = db.prepare(messagesByYearQuery).all(chatId);
    
    // Find most active year (from filtered data if year is specified, otherwise from all years)
    let mostActiveYear = null;
    let mostActiveYearCount = 0;
    if (year) {
      mostActiveYear = year;
      mostActiveYearCount = total.total;
    } else {
      messagesByYear.forEach(yearData => {
        if (yearData.count > mostActiveYearCount) {
          mostActiveYear = yearData.year;
          mostActiveYearCount = yearData.count;
        }
      });
    }
    
    // Calculate average messages per day
    let avgPerDay = 0;
    if (firstMessage.first_date && total.total > 0) {
      let startDate = firstMessage.first_date / 1000000 + new Date('2001-01-01').getTime();
      let endDate = Date.now();
      
      // If filtering by year, calculate for that year only
      if (year) {
        startDate = new Date(`${year}-01-01`).getTime();
        endDate = new Date(`${year}-12-31`).getTime();
      }
      
      const daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);
      avgPerDay = daysDiff > 0 ? (total.total / daysDiff).toFixed(1) : 0;
    }
    
    // Get chat name and participant count
    const chatInfoQuery = `
      SELECT 
        chat.display_name,
        chat.chat_identifier,
        COUNT(DISTINCT handle.id) as participant_count
      FROM chat
      JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE chat.ROWID = ?
      GROUP BY chat.ROWID
    `;
    const chatInfo = db.prepare(chatInfoQuery).get(chatId);
    
    // Calculate longest streak
    const streakQuery = `
      SELECT DISTINCT date(datetime(message.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch')) as message_date
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      WHERE chat_message_join.chat_id = ?
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        ${yearFilter}
      ORDER BY message_date
    `;
    const dates = db.prepare(streakQuery).all(...params);
    
    let longestStreak = 0;
    let currentStreak = 0;
    let lastDate = null;
    
    dates.forEach(row => {
      if (row.message_date) {
        const currentDate = new Date(row.message_date);
        
        if (lastDate) {
          const dayDiff = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));
          
          if (dayDiff === 1) {
            currentStreak++;
          } else {
            longestStreak = Math.max(longestStreak, currentStreak);
            currentStreak = 1;
          }
        } else {
          currentStreak = 1;
        }
        
        lastDate = currentDate;
      }
    });
    
    longestStreak = Math.max(longestStreak, currentStreak);
    
    db.close();
    
    return {
      totalMessages: total.total || 0,
      sentMessages: sentReceived.sent || 0,
      receivedMessages: sentReceived.received || 0,
      firstMessageDate: firstMessage.first_date,
      messagesByYear: messagesByYear,
      mostActiveYear: mostActiveYear,
      mostActiveYearCount: mostActiveYearCount,
      avgPerDay: avgPerDay,
      longestStreak: longestStreak,
      displayName: chatInfo?.display_name || chatInfo?.chat_identifier || 'Unnamed Group',
      participantCount: chatInfo?.participant_count || 0
    };
    
  } catch (error) {
    console.error('Error getting group chat stats:', error);
    return null;
  }
}

/**
 * Get top group chats by year
 */
function getTopGroupChatsByYear(year, limit = null) {
  try {
    const db = new Database(CLONE_DB_PATH, { readonly: true });
    
    let query = `
      SELECT 
        chat.ROWID as chat_id,
        chat.display_name,
        chat.chat_identifier,
        COUNT(DISTINCT message.ROWID) as message_count,
        COUNT(DISTINCT handle.id) as participant_count
      FROM chat
      JOIN chat_message_join ON chat.ROWID = chat_message_join.chat_id
      JOIN message ON chat_message_join.message_id = message.ROWID
      JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE strftime('%Y', datetime(message.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch')) = ?
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND chat.ROWID IN (
          SELECT chat_id 
          FROM chat_handle_join 
          GROUP BY chat_id 
          HAVING COUNT(handle_id) > 1
        )
      GROUP BY chat.ROWID
      ORDER BY message_count DESC
    `;
    
    if (limit) {
      query += ` LIMIT ?`;
      var results = db.prepare(query).all(year.toString(), limit);
    } else {
      var results = db.prepare(query).all(year.toString());
    }
    
    // Enhance results with participant handles
    const enhancedResults = results.map(result => {
      // Get participant handles for this chat
      const participantQuery = `
        SELECT DISTINCT handle.id
        FROM handle
        JOIN chat_handle_join ON handle.ROWID = chat_handle_join.handle_id
        WHERE chat_handle_join.chat_id = ?
        LIMIT 5
      `;
      const participants = db.prepare(participantQuery).all(result.chat_id);
      
      // Only use display_name if it exists and doesn't look like a chat ID
      let displayName = result.display_name;
      if (!displayName || displayName.startsWith('chat')) {
        displayName = null;
      }
      
      return {
        chatId: result.chat_id,
        displayName: displayName,
        messageCount: result.message_count,
        participantCount: result.participant_count,
        participantHandles: participants.map(p => p.id)
      };
    });
    
    db.close();
    
    return enhancedResults;
  } catch (error) {
    console.error('Error getting top group chats by year:', error);
    return [];
  }
}

/**
 * Get participants in a group chat (optionally filtered by year)
 */
function getGroupChatParticipants(chatId, year = null) {
  try {
    const db = new Database(CLONE_DB_PATH, { readonly: true });
    
    // Build year filter if specified
    let yearFilter = '';
    if (year) {
      yearFilter = ` AND strftime('%Y', datetime(message.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch')) = '${year}'`;
    }
    
    const query = `
      SELECT 
        handle.id as handle_id,
        handle.id as contact,
        COUNT(DISTINCT message.ROWID) as message_count
      FROM handle
      JOIN chat_handle_join ON handle.ROWID = chat_handle_join.handle_id
      LEFT JOIN message ON message.handle_id = handle.ROWID 
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND message.is_from_me = 0
        AND message.ROWID IN (
          SELECT message_id 
          FROM chat_message_join 
          WHERE chat_id = ?
        )
        ${yearFilter}
      WHERE chat_handle_join.chat_id = ?
      GROUP BY handle.id
      ORDER BY message_count DESC
    `;
    
    const participants = db.prepare(query).all(chatId, chatId);
    db.close();
    
    return participants.map(p => ({
      handleId: p.handle_id,
      contact: p.contact,
      messageCount: p.message_count,
      displayName: p.contact // Will be enhanced with contact info in renderer
    }));
  } catch (error) {
    console.error('Error getting group chat participants:', error);
    return [];
  }
}

/**
 * Get words from a group chat (optionally filtered by person and year)
 */
function getGroupChatWords(chatId, limit = 20, personId = null, year = null) {
  try {
    const db = new Database(CLONE_DB_PATH, { readonly: true });
    
    let whereClause = `
      WHERE chat_message_join.chat_id = ?
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND message.text IS NOT NULL
        AND message.text != ''
    `;
    
    const params = [chatId];
    
    // Add year filter if specified
    if (year) {
      whereClause += ` AND strftime('%Y', datetime(message.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch')) = ?`;
      params.push(year.toString());
    }
    
    // Add person filter if specified
    if (personId === 'you') {
      whereClause += ' AND message.is_from_me = 1';
    } else if (personId === 'all') {
      whereClause += ' AND message.is_from_me = 0';
    } else if (personId) {
      whereClause += ` AND message.handle_id IN (
        SELECT ROWID FROM handle WHERE id = ?
      )`;
      params.push(personId);
    }
    
    const query = `
      SELECT message.text
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      ${whereClause}
    `;
    
    const messages = db.prepare(query).all(...params);
    db.close();
    
    // Common words to exclude
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'i', 'you',
      'he', 'she', 'it', 'we', 'they', 'them', 'their', 'this', 'that', 'these', 'those', 'am', 'my', 
      'your', 'me', 'im', 'just', 'so', 'dont', 'didnt', 'cant', 'wont', 'like', 'yeah', 'yes', 'no',
      'ok', 'okay', 'lol', 'haha', 'oh', 'ah', 'um', 'uh', 'gonna', 'wanna', 'gotta', 'get', 'got', 'not']);
    
    // Count word frequencies
    const wordCounts = {};
    messages.forEach(msg => {
      if (msg.text) {
        const words = msg.text
          .toLowerCase()
          .replace(/[^\w\s']/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 2 && !stopWords.has(w));
        
        words.forEach(word => {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        });
      }
    });
    
    return Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word, count]) => ({ word, count }));
    
  } catch (error) {
    console.error('Error getting group chat words:', error);
    return [];
  }
}

/**
 * Get emojis from a group chat (optionally filtered by person and year)
 */
function getGroupChatEmojis(chatId, limit = 10, personId = null, year = null) {
  try {
    const db = new Database(CLONE_DB_PATH, { readonly: true });
    
    let whereClause = `
      WHERE chat_message_join.chat_id = ?
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND message.text IS NOT NULL
    `;
    
    const params = [chatId];
    
    // Add year filter if specified
    if (year) {
      whereClause += ` AND strftime('%Y', datetime(message.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch')) = ?`;
      params.push(year.toString());
    }
    
    // Add person filter if specified
    if (personId === 'you') {
      whereClause += ' AND message.is_from_me = 1';
    } else if (personId === 'all') {
      whereClause += ' AND message.is_from_me = 0';
    } else if (personId) {
      whereClause += ` AND message.handle_id IN (
        SELECT ROWID FROM handle WHERE id = ?
      )`;
      params.push(personId);
    }
    
    const query = `
      SELECT message.text
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      ${whereClause}
    `;
    
    const messages = db.prepare(query).all(...params);
    db.close();
    
    // Emoji regex
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    
    const emojiCounts = {};
    messages.forEach(msg => {
      if (msg.text) {
        const emojis = msg.text.match(emojiRegex);
        if (emojis) {
          emojis.forEach(emoji => {
            emojiCounts[emoji] = (emojiCounts[emoji] || 0) + 1;
          });
        }
      }
    });
    
    return Object.entries(emojiCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([emoji, count]) => ({ emoji, count }));
    
  } catch (error) {
    console.error('Error getting group chat emojis:', error);
    return [];
  }
}

/**
 * Search messages in a group chat (optionally filtered by person)
 */
function searchGroupChatMessages(chatId, searchTerm, limit = 10, offset = 0, personId = null) {
  try {
    if (!cloneExists()) {
      return { count: 0, examples: [] };
    }

    const db = new Database(CLONE_DB_PATH, { readonly: true });
    
    let whereClause = `
      WHERE chat_message_join.chat_id = ?
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND message.text IS NOT NULL
        AND message.text LIKE ?
    `;
    
    const countParams = [chatId];
    const examplesParams = [chatId];
    
    // Add person filter if specified
    if (personId === 'you') {
      whereClause += ' AND message.is_from_me = 1';
    } else if (personId === 'all') {
      whereClause += ' AND message.is_from_me = 0';
    } else if (personId) {
      whereClause += ' AND handle.id = ?';
      countParams.push(personId);
      examplesParams.push(personId);
    }
    
    const searchPattern = `%${searchTerm}%`;
    countParams.push(searchPattern);
    examplesParams.push(searchPattern);
    
    // Get count
    const countQuery = `
      SELECT COUNT(*) as count
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      ${personId && personId !== 'you' && personId !== 'all' ? 'JOIN handle ON message.handle_id = handle.ROWID' : ''}
      ${whereClause}
    `;
    
    const countResult = db.prepare(countQuery).get(...countParams);
    
    // Get examples
    const examplesQuery = `
      SELECT
        message.text,
        message.date,
        message.is_from_me,
        handle.id as sender_id
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      LEFT JOIN handle ON message.handle_id = handle.ROWID
      ${whereClause}
      ORDER BY message.date DESC
      LIMIT ? OFFSET ?
    `;
    
    examplesParams.push(limit, offset);
    const examples = db.prepare(examplesQuery).all(...examplesParams);
    
    db.close();
    
    // Format the examples
    const formattedExamples = examples.map(msg => ({
      text: msg.text,
      date: msg.date,
      isFromMe: msg.is_from_me === 1,
      senderId: msg.sender_id,
      formattedDate: msg.date ? 
        new Date(msg.date / 1000000 + new Date('2001-01-01').getTime()).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        }) : 
        'Unknown'
    }));
    
    return {
      count: countResult.count,
      examples: formattedExamples
    };
    
  } catch (error) {
    console.error('Error searching group chat messages:', error);
    return { count: 0, examples: [] };
  }
}

/**
 * Get all stats for the wrapped experience
 */
function getAllStats() {
  try {
    const totalMessages = getTotalMessages();
    const messagesByYear = getMessagesByYear();
    const topContacts = getTopContacts(); // Get all contacts (no limit)
    const sentVsReceived = getSentVsReceived();
    const mostActiveYear = getMostActiveYear();
    const avgPerDay = getAverageMessagesPerDay();
    
    return {
      totalMessages,
      messagesByYear,
      topContacts,
      sentVsReceived,
      mostActiveYear,
      avgPerDay
    };
  } catch (error) {
    console.error('Error getting all stats:', error);
    return null;
  }
}

/**
 * Get most common words from all messages
 */
function getAllWords(limit = 30) {
  try {
    if (!cloneExists()) {
      return [];
    }

    const db = new Database(CLONE_DB_PATH, { readonly: true });
    
    // Get all message texts (only from user, is_from_me = 1)
    const query = `
      SELECT message.text
      FROM message
      WHERE (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND message.text IS NOT NULL
        AND message.text != ''
        AND message.is_from_me = 1
    `;
    
    const messages = db.prepare(query).all();
    
    db.close();
    
    // Common words to exclude
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'i', 'you',
      'he', 'she', 'it', 'we', 'they', 'them', 'their', 'this', 'that', 'these', 'those', 'am', 'my', 
      'your', 'me', 'im', 'just', 'so', 'dont', 'didnt', 'cant', 'wont', 'like', 'yeah', 'yes', 'no',
      'ok', 'okay', 'lol', 'haha', 'oh', 'ah', 'um', 'uh', 'gonna', 'wanna', 'gotta', 'get', 'got', 'not']);
    
    // Count word frequencies
    const wordCounts = {};
    messages.forEach(msg => {
      if (msg.text) {
        // Clean and split text
        const words = msg.text
          .toLowerCase()
          .replace(/[^\w\s']/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 2 && !stopWords.has(w));
        
        words.forEach(word => {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        });
      }
    });
    
    // Sort by frequency and return top words
    return Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word, count]) => ({ word, count }));
    
  } catch (error) {
    console.error('Error getting all words:', error);
    return [];
  }
}

/**
 * Check if clone exists and is valid
 */
function cloneExists() {
  return fs.existsSync(CLONE_DB_PATH);
}

/**
 * Check if contacts clone exists
 */
function contactsCloneExists() {
  return fs.existsSync(CONTACTS_CLONE_PATH);
}

/**
 * Test contacts database - diagnostic function
 */
function testContactsDatabase() {
  try {
    if (!fs.existsSync(CONTACTS_CLONE_PATH)) {
      return { success: false, error: 'Contacts database not found' };
    }

    const db = new Database(CONTACTS_CLONE_PATH, { readonly: true });
    
    // Get table list
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `).all();
    
    console.log('📋 Tables found:', tables.map(t => t.name).join(', '));
    
    // Get record count
    let recordCount = { count: 0 };
    let phoneCount = { count: 0 };
    
    try {
      recordCount = db.prepare('SELECT COUNT(*) as count FROM ZABCDRECORD').get();
      console.log('📊 ZABCDRECORD count:', recordCount.count);
    } catch (e) {
      console.log('❌ ZABCDRECORD table does not exist');
    }
    
    try {
      phoneCount = db.prepare('SELECT COUNT(*) as count FROM ZABCDPHONENUMBER').get();
      console.log('📱 ZABCDPHONENUMBER count:', phoneCount.count);
    } catch (e) {
      console.log('❌ ZABCDPHONENUMBER table does not exist');
    }
    
    // Sample records with names
    const sampleRecords = db.prepare(`
      SELECT Z_PK, ZFIRSTNAME, ZLASTNAME, ZORGANIZATION
      FROM ZABCDRECORD 
      WHERE ZFIRSTNAME IS NOT NULL OR ZLASTNAME IS NOT NULL
      LIMIT 10
    `).all();
    
    // Sample phone numbers
    const samplePhones = db.prepare(`
      SELECT p.ZFULLNUMBER, r.ZFIRSTNAME, r.ZLASTNAME
      FROM ZABCDPHONENUMBER p
      LEFT JOIN ZABCDRECORD r ON p.ZOWNER = r.Z_PK
      WHERE p.ZFULLNUMBER IS NOT NULL
      LIMIT 10
    `).all();
    
    // Test with known numbers from your messages
    const testNumbers = ['5196171010', '6472715443', '6473836886'];
    const testResults = testNumbers.map(num => {
      const result = db.prepare(`
        SELECT r.ZFIRSTNAME, r.ZLASTNAME, p.ZFULLNUMBER
        FROM ZABCDRECORD r
        LEFT JOIN ZABCDPHONENUMBER p ON p.ZOWNER = r.Z_PK
        WHERE p.ZFULLNUMBER LIKE ?
        LIMIT 1
      `).get(`%${num}%`);
      
      return {
        number: num,
        found: !!result,
        name: result ? `${result.ZFIRSTNAME || ''} ${result.ZLASTNAME || ''}`.trim() : null,
        fullNumber: result ? result.ZFULLNUMBER : null
      };
    });
    
    db.close();
    
    return {
      success: true,
      tables: tables.map(t => t.name),
      recordCount: recordCount.count,
      phoneCount: phoneCount.count,
      sampleRecords,
      samplePhones,
      testResults
    };
    
  } catch (error) {
    console.error('Error testing contacts DB:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Save contacts to CSV file (with photos)
 */
function saveContactsCSV(contacts) {
  try {
    if (!fs.existsSync(APP_DATA_DIR)) {
      fs.mkdirSync(APP_DATA_DIR, { recursive: true });
    }

    // Create avatars directory
    const avatarsDir = path.join(APP_DATA_DIR, 'avatars');
    if (!fs.existsSync(avatarsDir)) {
      fs.mkdirSync(avatarsDir, { recursive: true });
    }

    console.log(`💾 Saving ${contacts.length} contacts to CSV...`);

    let photoCount = 0;

    // CSV format: name,phone,avatar
    const csvContent = 'name,phone,avatar\n' + contacts.map(c => {
      let avatarFilename = '';

      // Save photo if it exists
      if (c.photo) {
        try {
          // Clean phone/email for filename (use first 20 chars, replace special chars)
          const cleanHandle = c.phone.replace(/[^\w]/g, '').substring(0, 20);
          avatarFilename = `${cleanHandle}.jpg`;
          const avatarPath = path.join(avatarsDir, avatarFilename);

          // Decode base64 and save
          const base64Data = c.photo.replace(/^data:image\/\w+;base64,/, '').replace(/\s/g, '');

          // Validate base64 data
          if (base64Data.length > 0 && base64Data.length % 4 === 0) {
            const buffer = Buffer.from(base64Data, 'base64');
            // Only save if buffer is valid size (at least 100 bytes)
            if (buffer.length > 100) {
              fs.writeFileSync(avatarPath, buffer);
              photoCount++;
            } else {
              console.warn(`⚠️  Photo too small for ${c.name}, skipping`);
              avatarFilename = '';
            }
          } else {
            console.warn(`⚠️  Invalid base64 data for ${c.name}, skipping`);
            avatarFilename = '';
          }
        } catch (photoError) {
          console.error(`❌ Error saving photo for ${c.name}:`, photoError.message);
          avatarFilename = '';
        }
      }

      return `"${c.name.replace(/"/g, '""')}","${c.phone}","${avatarFilename}"`;
    }).join('\n');

    fs.writeFileSync(CONTACTS_CSV_PATH, csvContent, 'utf8');
    console.log(`✅ Saved contacts to: ${CONTACTS_CSV_PATH}`);
    console.log(`📸 Saved ${photoCount} profile pictures to: ${avatarsDir}`);

    return { success: true, path: CONTACTS_CSV_PATH, photoCount };
  } catch (error) {
    console.error('❌ Error saving contacts CSV:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Load contacts from CSV file (with photos)
 */
function loadContactsCSV() {
  try {
    if (!fs.existsSync(CONTACTS_CSV_PATH)) {
      console.log('⚠️  No contacts CSV found');
      return [];
    }

    console.log('📂 Loading contacts from CSV...');
    const csvContent = fs.readFileSync(CONTACTS_CSV_PATH, 'utf8');
    const lines = csvContent.split('\n');
    const avatarsDir = path.join(APP_DATA_DIR, 'avatars');

    // Skip header row
    const contacts = [];
    let photoCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV (handle quoted values) - format: name,phone,avatar
      const match = line.match(/"([^"]*)","([^"]*)","([^"]*)"/);
      if (match) {
        const contact = {
          name: match[1].replace(/""/g, '"'),
          phone: match[2],
          avatar: match[3]
        };

        // Load photo as base64 if it exists
        if (contact.avatar) {
          const avatarPath = path.join(avatarsDir, contact.avatar);
          if (fs.existsSync(avatarPath)) {
            try {
              const imageBuffer = fs.readFileSync(avatarPath);
              // Only include photo if buffer is valid size
              if (imageBuffer.length > 100) {
                contact.photo = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
                photoCount++;
              } else {
                console.warn(`⚠️  Photo too small for ${contact.name}, skipping`);
              }
            } catch (photoError) {
              console.error(`❌ Error loading photo for ${contact.name}:`, photoError.message);
            }
          }
        }

        contacts.push(contact);
      }
    }

    console.log(`✅ Loaded ${contacts.length} contacts from CSV`);
    console.log(`📸 Loaded ${photoCount} profile pictures`);
    return contacts;
  } catch (error) {
    console.error('❌ Error loading contacts CSV:', error);
    return [];
  }
}

/**
 * Check if contacts CSV exists
 */
function contactsCSVExists() {
  return fs.existsSync(CONTACTS_CSV_PATH);
}

/**
 * Get all years with messages (for year selector)
 */
function getAvailableYears() {
  try {
    const db = new Database(CLONE_DB_PATH, { readonly: true });
    
    const query = `
      SELECT DISTINCT strftime('%Y', datetime(message.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch')) as year
      FROM message
      WHERE year IS NOT NULL
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
      ORDER BY year DESC
    `;
    
    const results = db.prepare(query).all();
    db.close();
    
    return results.map(r => r.year);
  } catch (error) {
    console.error('Error getting available years:', error);
    return [];
  }
}

/**
 * Get top contacts for a specific year
 */
function getTopContactsByYear(year, limit = null) {
  try {
    const db = new Database(CLONE_DB_PATH, { readonly: true });
    
    const placeholders = EXCLUDED_NUMBERS.map(() => '?').join(',');
    
    let query = `
      SELECT 
        handle.id as contact,
        COUNT(DISTINCT message.ROWID) as message_count
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat_handle_join ON chat_message_join.chat_id = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE handle.id IS NOT NULL 
        AND handle.id != '' 
        AND handle.id NOT IN (${placeholders})
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND strftime('%Y', datetime(message.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch')) = ?
        AND chat_message_join.chat_id IN (
          SELECT chat_id 
          FROM chat_handle_join 
          GROUP BY chat_id 
          HAVING COUNT(handle_id) = 1
        )
      GROUP BY handle.id
      ORDER BY message_count DESC
    `;
    
    if (limit) {
      query += ` LIMIT ?`;
      var results = db.prepare(query).all(...EXCLUDED_NUMBERS, year, limit);
    } else {
      var results = db.prepare(query).all(...EXCLUDED_NUMBERS, year);
    }
    
    db.close();
    
    // Format display names
    const enrichedResults = results.map((result) => {
      let displayName = result.contact;
      
      if (result.contact.match(/^\+?1?(\d{10})$/)) {
        const cleaned = result.contact.replace(/\D/g, '').slice(-10);
        displayName = `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
      } else if (result.contact.includes('@')) {
        displayName = result.contact;
      }
      
      return {
        ...result,
        contact: result.contact,
        displayName: displayName,
        hasPhoto: false,
        imageData: null
      };
    });
    
    return enrichedResults;
  } catch (error) {
    console.error('Error getting top contacts by year:', error);
    return [];
  }
}

/**
 * Get detailed stats for a specific contact
 */
function getContactStats(contactHandle) {
  try {
    if (!cloneExists()) {
      return null;
    }

    const db = new Database(CLONE_DB_PATH, { readonly: true });
    
    // Build exclusion clause
    const exclusion = buildContactExclusionClause();
    
    // Get total messages with this contact
    const totalQuery = `
      SELECT COUNT(*) as total
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat ON chat_message_join.chat_id = chat.ROWID
      JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE handle.id = ?
        ${exclusion.clause}
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND chat_message_join.chat_id IN (
          SELECT chat_id 
          FROM chat_handle_join 
          GROUP BY chat_id 
          HAVING COUNT(handle_id) = 1
        )
    `;
    const total = db.prepare(totalQuery).get(contactHandle, ...exclusion.params);
    
    // Get sent vs received
    const sentReceivedQuery = `
      SELECT 
        SUM(CASE WHEN message.is_from_me = 1 THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN message.is_from_me = 0 THEN 1 ELSE 0 END) as received
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat ON chat_message_join.chat_id = chat.ROWID
      JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE handle.id = ?
        ${exclusion.clause}
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND chat_message_join.chat_id IN (
          SELECT chat_id 
          FROM chat_handle_join 
          GROUP BY chat_id 
          HAVING COUNT(handle_id) = 1
        )
    `;
    const sentReceived = db.prepare(sentReceivedQuery).get(contactHandle, ...exclusion.params);
    
    // Get first message date
    const firstMessageQuery = `
      SELECT MIN(message.date) as first_date
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat ON chat_message_join.chat_id = chat.ROWID
      JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE handle.id = ?
        ${exclusion.clause}
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND chat_message_join.chat_id IN (
          SELECT chat_id 
          FROM chat_handle_join 
          GROUP BY chat_id 
          HAVING COUNT(handle_id) = 1
        )
    `;
    const firstMessage = db.prepare(firstMessageQuery).get(contactHandle, ...exclusion.params);
    
    // Get messages by year for this contact
    const messagesByYearQuery = `
      SELECT 
        strftime('%Y', datetime(message.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch')) as year,
        COUNT(*) as count
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat ON chat_message_join.chat_id = chat.ROWID
      JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE handle.id = ?
        ${exclusion.clause}
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND chat_message_join.chat_id IN (
          SELECT chat_id 
          FROM chat_handle_join 
          GROUP BY chat_id 
          HAVING COUNT(handle_id) = 1
        )
      GROUP BY year
      ORDER BY year
    `;
    const messagesByYear = db.prepare(messagesByYearQuery).all(contactHandle, ...exclusion.params);
    
    // Find most active year
    let mostActiveYear = null;
    let mostActiveYearCount = 0;
    messagesByYear.forEach(row => {
      if (row.count > mostActiveYearCount) {
        mostActiveYear = row.year;
        mostActiveYearCount = row.count;
      }
    });
    
    // Calculate average messages per day
    const daysSinceFirst = firstMessage.first_date ? 
      (Date.now() - (firstMessage.first_date / 1000000 + new Date('2001-01-01').getTime())) / (1000 * 60 * 60 * 24) : 
      0;
    const avgPerDay = daysSinceFirst > 0 ? (total.total / daysSinceFirst).toFixed(1) : 0;
    
    // Calculate longest streak
    const streakQuery = `
      SELECT DISTINCT date(datetime(message.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch')) as message_date
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat ON chat_message_join.chat_id = chat.ROWID
      JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE handle.id = ?
        ${exclusion.clause}
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND chat_message_join.chat_id IN (
          SELECT chat_id 
          FROM chat_handle_join 
          GROUP BY chat_id 
          HAVING COUNT(handle_id) = 1
        )
      ORDER BY message_date
    `;
    const dates = db.prepare(streakQuery).all(contactHandle, ...exclusion.params);
    
    let longestStreak = 0;
    let currentStreak = 0;
    let lastDate = null;
    
    dates.forEach(row => {
      if (row.message_date) {
        const currentDate = new Date(row.message_date);
        
        if (lastDate) {
          const dayDiff = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));
          
          if (dayDiff === 1) {
            currentStreak++;
          } else {
            longestStreak = Math.max(longestStreak, currentStreak);
            currentStreak = 1;
          }
        } else {
          currentStreak = 1;
        }
        
        lastDate = currentDate;
      }
    });
    
    longestStreak = Math.max(longestStreak, currentStreak);
    
    db.close();
    
    return {
      totalMessages: total.total || 0,
      sentMessages: sentReceived.sent || 0,
      receivedMessages: sentReceived.received || 0,
      firstMessageDate: firstMessage.first_date,
      messagesByYear: messagesByYear,
      mostActiveYear: mostActiveYear,
      mostActiveYearCount: mostActiveYearCount,
      avgPerDay: avgPerDay,
      longestStreak: longestStreak
    };
    
  } catch (error) {
    console.error('Error getting contact stats:', error);
    return null;
  }
}

/**
 * Get most common words from messages with a specific contact
 */
function getContactWords(contactHandle, limit = 20, filter = 'both') {
  try {
    if (!cloneExists()) {
      return [];
    }

    const db = new Database(CLONE_DB_PATH, { readonly: true });
    
    // Build exclusion clause
    const exclusionClause = EXCLUDED_NUMBERS.map(() => `handle.id != ?`).join(' AND ');
    
    // Build filter clause based on sender filter
    let filterClause = '';
    if (filter === 'you') {
      filterClause = 'AND message.is_from_me = 1';
    } else if (filter === 'them') {
      filterClause = 'AND message.is_from_me = 0';
    }
    
    // Get all message texts
    const query = `
      SELECT message.text
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat ON chat_message_join.chat_id = chat.ROWID
      JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE handle.id = ?
        AND ${exclusionClause}
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND message.text IS NOT NULL
        AND message.text != ''
        ${filterClause}
        AND chat_message_join.chat_id IN (
          SELECT chat_id 
          FROM chat_handle_join 
          GROUP BY chat_id 
          HAVING COUNT(handle_id) = 1
        )
    `;
    const messages = db.prepare(query).all(contactHandle, ...EXCLUDED_NUMBERS);
    
    db.close();
    
    // Common words to exclude
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'i', 'you',
      'he', 'she', 'it', 'we', 'they', 'them', 'their', 'this', 'that', 'these', 'those', 'am', 'my', 
      'your', 'me', 'im', 'just', 'so', 'dont', 'didnt', 'cant', 'wont', 'like', 'yeah', 'yes', 'no',
      'ok', 'okay', 'lol', 'haha', 'oh', 'ah', 'um', 'uh', 'gonna', 'wanna', 'gotta', 'get', 'got', 'not']);
    
    // Count word frequencies
    const wordCounts = {};
    messages.forEach(msg => {
      if (msg.text) {
        // Clean and split text
        const words = msg.text
          .toLowerCase()
          .replace(/[^\w\s']/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 2 && !stopWords.has(w));
        
        words.forEach(word => {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        });
      }
    });
    
    // Sort by frequency and return top words
    return Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word, count]) => ({ word, count }));
    
  } catch (error) {
    console.error('Error getting contact words:', error);
    return [];
  }
}

/**
 * Get most common emojis from messages with a specific contact
 */
function getContactEmojis(contactHandle, limit = 10) {
  try {
    if (!cloneExists()) {
      return [];
    }

    const db = new Database(CLONE_DB_PATH, { readonly: true });
    
    // Build exclusion clause
    const exclusionClause = EXCLUDED_NUMBERS.map(() => `handle.id != ?`).join(' AND ');
    
    // Get all message texts
    const query = `
      SELECT message.text
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat ON chat_message_join.chat_id = chat.ROWID
      JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE handle.id = ?
        AND ${exclusionClause}
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND message.text IS NOT NULL
        AND message.text != ''
        AND chat_message_join.chat_id IN (
          SELECT chat_id 
          FROM chat_handle_join 
          GROUP BY chat_id 
          HAVING COUNT(handle_id) = 1
        )
    `;
    const messages = db.prepare(query).all(contactHandle, ...EXCLUDED_NUMBERS);
    
    db.close();
    
    // Emoji regex
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{238C}-\u{2454}\u{20D0}-\u{20FF}]/gu;
    
    // Count emoji frequencies
    const emojiCounts = {};
    messages.forEach(msg => {
      if (msg.text) {
        const emojis = msg.text.match(emojiRegex);
        if (emojis) {
          emojis.forEach(emoji => {
            emojiCounts[emoji] = (emojiCounts[emoji] || 0) + 1;
          });
        }
      }
    });
    
    // Sort by frequency and return top emojis
    return Object.entries(emojiCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([emoji, count]) => ({ emoji, count }));
    
  } catch (error) {
    console.error('Error getting contact emojis:', error);
    return [];
  }
}

/**
 * Get detailed stats for a specific contact in a specific year
 */
function getContactStatsByYear(contactHandle, year) {
  try {
    if (!cloneExists()) {
      return null;
    }

    const db = new Database(CLONE_DB_PATH, { readonly: true });
    
    // Build exclusion clause
    const exclusionClause = EXCLUDED_NUMBERS.map(() => `handle.id != ?`).join(' AND ');
    
    // Get total messages with this contact in this year
    const totalQuery = `
      SELECT COUNT(*) as total
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat ON chat_message_join.chat_id = chat.ROWID
      JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE handle.id = ?
        AND ${exclusionClause}
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND strftime('%Y', datetime(message.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch')) = ?
        AND chat_message_join.chat_id IN (
          SELECT chat_id
          FROM chat_handle_join
          GROUP BY chat_id
          HAVING COUNT(handle_id) = 1
        )
    `;
    const total = db.prepare(totalQuery).get(contactHandle, ...EXCLUDED_NUMBERS, year);

    // Get sent vs received
    const sentReceivedQuery = `
      SELECT
        SUM(CASE WHEN message.is_from_me = 1 THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN message.is_from_me = 0 THEN 1 ELSE 0 END) as received
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat ON chat_message_join.chat_id = chat.ROWID
      JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE handle.id = ?
        AND ${exclusionClause}
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND strftime('%Y', datetime(message.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch')) = ?
        AND chat_message_join.chat_id IN (
          SELECT chat_id
          FROM chat_handle_join
          GROUP BY chat_id
          HAVING COUNT(handle_id) = 1
        )
    `;
    const sentReceived = db.prepare(sentReceivedQuery).get(contactHandle, ...EXCLUDED_NUMBERS, year);

    // Get first message date for this year
    const firstMessageQuery = `
      SELECT MIN(message.date) as first_date
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat ON chat_message_join.chat_id = chat.ROWID
      JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE handle.id = ?
        AND ${exclusionClause}
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND strftime('%Y', datetime(message.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch')) = ?
        AND chat_message_join.chat_id IN (
          SELECT chat_id
          FROM chat_handle_join
          GROUP BY chat_id
          HAVING COUNT(handle_id) = 1
        )
    `;
    const firstMessage = db.prepare(firstMessageQuery).get(contactHandle, ...EXCLUDED_NUMBERS, year);
    
    // Calculate average messages per day for this year
    const startOfYear = new Date(`${year}-01-01`).getTime();
    const endOfYear = new Date(`${year}-12-31`).getTime();
    const daysInYear = (endOfYear - startOfYear) / (1000 * 60 * 60 * 24);
    const avgPerDay = daysInYear > 0 ? (total.total / daysInYear).toFixed(1) : 0;
    
    // Calculate longest streak for this year
    const streakQuery = `
      SELECT DISTINCT date(datetime(message.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch')) as message_date
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat ON chat_message_join.chat_id = chat.ROWID
      JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE handle.id = ?
        AND ${exclusionClause}
        AND strftime('%Y', datetime(message.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch')) = ?
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND chat_message_join.chat_id IN (
          SELECT chat_id 
          FROM chat_handle_join 
          GROUP BY chat_id 
          HAVING COUNT(handle_id) = 1
        )
      ORDER BY message_date
    `;
    const dates = db.prepare(streakQuery).all(contactHandle, ...EXCLUDED_NUMBERS, year);
    
    let longestStreak = 0;
    let currentStreak = 0;
    let lastDate = null;
    
    dates.forEach(row => {
      if (row.message_date) {
        const currentDate = new Date(row.message_date);
        
        if (lastDate) {
          const dayDiff = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));
          
          if (dayDiff === 1) {
            currentStreak++;
          } else {
            longestStreak = Math.max(longestStreak, currentStreak);
            currentStreak = 1;
          }
        } else {
          currentStreak = 1;
        }
        
        lastDate = currentDate;
      }
    });
    
    longestStreak = Math.max(longestStreak, currentStreak);
    
    db.close();
    
    return {
      totalMessages: total.total || 0,
      sentMessages: sentReceived.sent || 0,
      receivedMessages: sentReceived.received || 0,
      firstMessageDate: firstMessage.first_date,
      messagesByYear: [{ year: year, count: total.total }],
      mostActiveYear: year,
      mostActiveYearCount: total.total,
      avgPerDay: avgPerDay,
      longestStreak: longestStreak
    };
    
  } catch (error) {
    console.error('Error getting contact stats by year:', error);
    return null;
  }
}

/**
 * Get most common words from messages with a specific contact in a specific year
 */
function getContactWordsByYear(contactHandle, year, limit = 20) {
  try {
    if (!cloneExists()) {
      return [];
    }

    const db = new Database(CLONE_DB_PATH, { readonly: true });
    
    const exclusionClause = EXCLUDED_NUMBERS.map(() => `handle.id != ?`).join(' AND ');
    
    const query = `
      SELECT message.text
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat ON chat_message_join.chat_id = chat.ROWID
      JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE handle.id = ?
        AND ${exclusionClause}
        AND strftime('%Y', datetime(message.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch')) = ?
        AND message.text IS NOT NULL
        AND message.text != ''
        AND chat_message_join.chat_id IN (
          SELECT chat_id 
          FROM chat_handle_join 
          GROUP BY chat_id 
          HAVING COUNT(handle_id) = 1
        )
    `;
    const messages = db.prepare(query).all(contactHandle, ...EXCLUDED_NUMBERS, year);
    
    db.close();
    
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'i', 'you',
      'he', 'she', 'it', 'we', 'they', 'them', 'their', 'this', 'that', 'these', 'those', 'am', 'my', 
      'your', 'me', 'im', 'just', 'so', 'dont', 'didnt', 'cant', 'wont', 'like', 'yeah', 'yes', 'no',
      'ok', 'okay', 'lol', 'haha', 'oh', 'ah', 'um', 'uh', 'gonna', 'wanna', 'gotta', 'get', 'got', 'not']);
    
    const wordCounts = {};
    messages.forEach(msg => {
      if (msg.text) {
        const words = msg.text
          .toLowerCase()
          .replace(/[^\w\s']/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 2 && !stopWords.has(w));
        
        words.forEach(word => {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        });
      }
    });
    
    return Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word, count]) => ({ word, count }));
    
  } catch (error) {
    console.error('Error getting contact words by year:', error);
    return [];
  }
}

/**
 * Get most common emojis from messages with a specific contact in a specific year
 */
function getContactEmojisByYear(contactHandle, year, limit = 10) {
  try {
    if (!cloneExists()) {
      return [];
    }

    const db = new Database(CLONE_DB_PATH, { readonly: true });
    
    const exclusionClause = EXCLUDED_NUMBERS.map(() => `handle.id != ?`).join(' AND ');
    
    const query = `
      SELECT message.text
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat ON chat_message_join.chat_id = chat.ROWID
      JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE handle.id = ?
        AND ${exclusionClause}
        AND strftime('%Y', datetime(message.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch')) = ?
        AND message.text IS NOT NULL
        AND message.text != ''
        AND chat_message_join.chat_id IN (
          SELECT chat_id 
          FROM chat_handle_join 
          GROUP BY chat_id 
          HAVING COUNT(handle_id) = 1
        )
    `;
    const messages = db.prepare(query).all(contactHandle, ...EXCLUDED_NUMBERS, year);
    
    db.close();
    
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{238C}-\u{2454}\u{20D0}-\u{20FF}]/gu;
    
    const emojiCounts = {};
    messages.forEach(msg => {
      if (msg.text) {
        const emojis = msg.text.match(emojiRegex);
        if (emojis) {
          emojis.forEach(emoji => {
            emojiCounts[emoji] = (emojiCounts[emoji] || 0) + 1;
          });
        }
      }
    });
    
    return Object.entries(emojiCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([emoji, count]) => ({ emoji, count }));
    
  } catch (error) {
    console.error('Error getting contact emojis by year:', error);
    return [];
  }
}

/**
 * Get combined stats for multiple contact handles (same person with multiple numbers/emails)
 */
function getCombinedContactStats(contactHandles) {
  try {
    if (!Array.isArray(contactHandles) || contactHandles.length === 0) {
      return null;
    }
    
    // Get stats for each handle and combine them
    const allStats = contactHandles.map(handle => getContactStats(handle)).filter(s => s !== null);
    
    if (allStats.length === 0) return null;
    
    // Combine the stats
    const combined = {
      totalMessages: allStats.reduce((sum, s) => sum + s.totalMessages, 0),
      sentMessages: allStats.reduce((sum, s) => sum + s.sentMessages, 0),
      receivedMessages: allStats.reduce((sum, s) => sum + s.receivedMessages, 0),
      firstMessageDate: Math.min(...allStats.map(s => s.firstMessageDate).filter(d => d)),
      mostActiveYear: null,
      mostActiveYearCount: 0,
      avgPerDay: 0,
      messagesByYear: {}
    };
    
    // Combine messagesByYear
    allStats.forEach(stats => {
      stats.messagesByYear.forEach(yearData => {
        if (combined.messagesByYear[yearData.year]) {
          combined.messagesByYear[yearData.year] += yearData.count;
        } else {
          combined.messagesByYear[yearData.year] = yearData.count;
        }
      });
    });
    
    // Find most active year
    combined.messagesByYear = Object.entries(combined.messagesByYear).map(([year, count]) => ({
      year,
      count
    }));
    
    combined.messagesByYear.forEach(yearData => {
      if (yearData.count > combined.mostActiveYearCount) {
        combined.mostActiveYear = yearData.year;
        combined.mostActiveYearCount = yearData.count;
      }
    });
    
    // Calculate average per day
    const daysSinceFirst = combined.firstMessageDate ?
      (Date.now() - (combined.firstMessageDate / 1000000 + new Date('2001-01-01').getTime())) / (1000 * 60 * 60 * 24) :
      0;
    combined.avgPerDay = daysSinceFirst > 0 ? (combined.totalMessages / daysSinceFirst).toFixed(1) : 0;

    // Calculate longest streak across all handles
    // Get all message dates from all handles
    const db = new Database(CLONE_DB_PATH, { readonly: true });
    const exclusion = buildContactExclusionClause();

    const placeholders = contactHandles.map(() => '?').join(',');
    const streakQuery = `
      SELECT DISTINCT date(datetime(message.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch')) as message_date
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat ON chat_message_join.chat_id = chat.ROWID
      JOIN handle ON chat.ROWID IN (
        SELECT chat_id FROM chat_handle_join WHERE handle_id = handle.ROWID
      )
      WHERE handle.id IN (${placeholders})
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND chat_message_join.chat_id IN (
          SELECT chat_id
          FROM chat_handle_join
          GROUP BY chat_id
          HAVING COUNT(handle_id) = 1
        )
        ${exclusion.clause}
      ORDER BY message_date
    `;
    const dates = db.prepare(streakQuery).all(...contactHandles, ...exclusion.params);

    let longestStreak = 0;
    let currentStreak = 0;
    let lastDate = null;

    dates.forEach(row => {
      if (row.message_date) {
        const currentDate = new Date(row.message_date);

        if (lastDate) {
          const dayDiff = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));

          if (dayDiff === 1) {
            currentStreak++;
          } else {
            longestStreak = Math.max(longestStreak, currentStreak);
            currentStreak = 1;
          }
        } else {
          currentStreak = 1;
        }

        lastDate = currentDate;
      }
    });

    longestStreak = Math.max(longestStreak, currentStreak);
    combined.longestStreak = longestStreak;

    db.close();

    return combined;
  } catch (error) {
    console.error('Error getting combined contact stats:', error);
    return null;
  }
}

/**
 * Get combined words for multiple contact handles
 */
function getCombinedContactWords(contactHandles, limit = 20, filter = 'both') {
  try {
    if (!Array.isArray(contactHandles) || contactHandles.length === 0) {
      return [];
    }
    
    // Get words for each handle with filter
    const allWords = contactHandles.map(handle => getContactWords(handle, limit * 2, filter));
    
    // Combine word counts
    const wordCounts = {};
    allWords.forEach(wordList => {
      wordList.forEach(({ word, count }) => {
        wordCounts[word] = (wordCounts[word] || 0) + count;
      });
    });
    
    // Sort and return top words
    return Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word, count]) => ({ word, count }));
  } catch (error) {
    console.error('Error getting combined contact words:', error);
    return [];
  }
}

/**
 * Get combined emojis for multiple contact handles
 */
function getCombinedContactEmojis(contactHandles, limit = 10) {
  try {
    if (!Array.isArray(contactHandles) || contactHandles.length === 0) {
      return [];
    }
    
    // Get emojis for each handle
    const allEmojis = contactHandles.map(handle => getContactEmojis(handle, limit * 2));
    
    // Combine emoji counts
    const emojiCounts = {};
    allEmojis.forEach(emojiList => {
      emojiList.forEach(({ emoji, count }) => {
        emojiCounts[emoji] = (emojiCounts[emoji] || 0) + count;
      });
    });
    
    // Sort and return top emojis
    return Object.entries(emojiCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([emoji, count]) => ({ emoji, count }));
  } catch (error) {
    console.error('Error getting combined contact emojis:', error);
    return [];
  }
}

/**
 * Get combined stats by year for multiple contact handles
 */
function getCombinedContactStatsByYear(contactHandles, year) {
  try {
    if (!Array.isArray(contactHandles) || contactHandles.length === 0) {
      return null;
    }
    
    // Get stats for each handle and combine them
    const allStats = contactHandles.map(handle => getContactStatsByYear(handle, year)).filter(s => s !== null);
    
    if (allStats.length === 0) return null;
    
    // Combine the stats
    const combined = {
      totalMessages: allStats.reduce((sum, s) => sum + s.totalMessages, 0),
      sentMessages: allStats.reduce((sum, s) => sum + s.sentMessages, 0),
      receivedMessages: allStats.reduce((sum, s) => sum + s.receivedMessages, 0),
      firstMessageDate: Math.min(...allStats.map(s => s.firstMessageDate).filter(d => d)),
      messagesByYear: [{ year: year, count: allStats.reduce((sum, s) => sum + s.totalMessages, 0) }],
      mostActiveYear: year,
      mostActiveYearCount: allStats.reduce((sum, s) => sum + s.totalMessages, 0),
      avgPerDay: (allStats.reduce((sum, s) => sum + parseFloat(s.avgPerDay), 0) / allStats.length).toFixed(1)
    };

    // Calculate longest streak for the specified year across all handles
    const db = new Database(CLONE_DB_PATH, { readonly: true });

    const placeholders = contactHandles.map(() => '?').join(',');
    const streakQuery = `
      SELECT DISTINCT date(datetime(message.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch')) as message_date
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat ON chat_message_join.chat_id = chat.ROWID
      JOIN handle ON chat.ROWID IN (
        SELECT chat_id FROM chat_handle_join WHERE handle_id = handle.ROWID
      )
      WHERE handle.id IN (${placeholders})
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND strftime('%Y', datetime(message.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch')) = ?
        AND chat_message_join.chat_id IN (
          SELECT chat_id
          FROM chat_handle_join
          GROUP BY chat_id
          HAVING COUNT(handle_id) = 1
        )
      ORDER BY message_date
    `;
    const dates = db.prepare(streakQuery).all(...contactHandles, year);

    let longestStreak = 0;
    let currentStreak = 0;
    let lastDate = null;

    dates.forEach(row => {
      if (row.message_date) {
        const currentDate = new Date(row.message_date);

        if (lastDate) {
          const dayDiff = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));

          if (dayDiff === 1) {
            currentStreak++;
          } else {
            longestStreak = Math.max(longestStreak, currentStreak);
            currentStreak = 1;
          }
        } else {
          currentStreak = 1;
        }

        lastDate = currentDate;
      }
    });

    longestStreak = Math.max(longestStreak, currentStreak);
    combined.longestStreak = longestStreak;

    db.close();

    return combined;
  } catch (error) {
    console.error('Error getting combined contact stats by year:', error);
    return null;
  }
}

/**
 * Get combined words by year for multiple contact handles
 */
function getCombinedContactWordsByYear(contactHandles, year, limit = 20) {
  try {
    if (!Array.isArray(contactHandles) || contactHandles.length === 0) {
      return [];
    }
    
    // Get words for each handle
    const allWords = contactHandles.map(handle => getContactWordsByYear(handle, year, limit * 2));
    
    // Combine word counts
    const wordCounts = {};
    allWords.forEach(wordList => {
      wordList.forEach(({ word, count }) => {
        wordCounts[word] = (wordCounts[word] || 0) + count;
      });
    });
    
    // Sort and return top words
    return Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word, count]) => ({ word, count }));
  } catch (error) {
    console.error('Error getting combined contact words by year:', error);
    return [];
  }
}

/**
 * Get combined emojis by year for multiple contact handles
 */
function getCombinedContactEmojisByYear(contactHandles, year, limit = 10) {
  try {
    if (!Array.isArray(contactHandles) || contactHandles.length === 0) {
      return [];
    }
    
    // Get emojis for each handle
    const allEmojis = contactHandles.map(handle => getContactEmojisByYear(handle, year, limit * 2));
    
    // Combine emoji counts
    const emojiCounts = {};
    allEmojis.forEach(emojiList => {
      emojiList.forEach(({ emoji, count }) => {
        emojiCounts[emoji] = (emojiCounts[emoji] || 0) + count;
      });
    });
    
    // Sort and return top emojis
    return Object.entries(emojiCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([emoji, count]) => ({ emoji, count }));
  } catch (error) {
    console.error('Error getting combined contact emojis by year:', error);
    return [];
  }
}

/**
 * Get reaction stats for a contact
 */
function getContactReactions(contactHandle, year = null) {
  try {
    if (!cloneExists()) {
      return { yourReactions: [], theirReactions: [] };
    }

    const db = new Database(CLONE_DB_PATH, { readonly: true });

    // Build exclusion clause
    const exclusionClause = EXCLUDED_NUMBERS.map(() => `handle.id != ?`).join(' AND ');

    // Build year filter if specified
    let yearFilter = '';
    if (year) {
      const startDate = new Date(`${year}-01-01`).getTime();
      const endDate = new Date(`${year}-12-31 23:59:59`).getTime();
      const startTimestamp = (startDate - new Date('2001-01-01').getTime()) * 1000000;
      const endTimestamp = (endDate - new Date('2001-01-01').getTime()) * 1000000;
      yearFilter = `AND message.date >= ${startTimestamp} AND message.date <= ${endTimestamp}`;
    }

    // Map reaction types to emoji
    // iMessage stores reactions with simpler type values
    const reactionMap = {
      // Standard reactions (0-5)
      0: '❤️',   // Love/Heart
      1: '👍',   // Like/Thumbs up
      2: '👎',   // Dislike/Thumbs down
      3: '😂',   // Laugh/Haha
      4: '‼️',   // Emphasize/Exclamation
      5: '❓',   // Question mark
      // Removed reactions (1000 series)
      1000: '👍',  // Like (removed)
      1001: '👎',  // Dislike (removed)
      1002: '😂',  // Laugh (removed)
      1003: '❤️',  // Love (removed)
      1004: '‼️',  // Emphasize (removed)
      1005: '❓',  // Question (removed)
      // Other variants (2000 series)
      2000: '❤️',
      2001: '👍',
      2002: '👎',
      2003: '😂',
      2004: '‼️',
      2005: '❓',
      2006: '🔥',  // Could be a special reaction or "loved with effect"
      // String versions
      '0': '❤️',
      '1': '👍',
      '2': '👎',
      '3': '😂',
      '4': '‼️',
      '5': '❓'
    };

    // Get reactions you sent
    const yourReactionsQuery = `
      SELECT
        message.associated_message_type as type,
        COUNT(*) as count
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat ON chat_message_join.chat_id = chat.ROWID
      JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE handle.id = ?
        AND ${exclusionClause}
        AND message.is_from_me = 1
        AND message.associated_message_type IS NOT NULL
        AND message.associated_message_type != 0
        AND message.associated_message_type != 3000
        ${yearFilter}
        AND chat_message_join.chat_id IN (
          SELECT chat_id
          FROM chat_handle_join
          GROUP BY chat_id
          HAVING COUNT(handle_id) = 1
        )
      GROUP BY message.associated_message_type
      ORDER BY count DESC
    `;

    // Get reactions they sent
    const theirReactionsQuery = `
      SELECT
        message.associated_message_type as type,
        COUNT(*) as count
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat ON chat_message_join.chat_id = chat.ROWID
      JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE handle.id = ?
        AND ${exclusionClause}
        AND message.is_from_me = 0
        AND message.associated_message_type IS NOT NULL
        AND message.associated_message_type != 0
        AND message.associated_message_type != 3000
        ${yearFilter}
        AND chat_message_join.chat_id IN (
          SELECT chat_id
          FROM chat_handle_join
          GROUP BY chat_id
          HAVING COUNT(handle_id) = 1
        )
      GROUP BY message.associated_message_type
      ORDER BY count DESC
    `;

    const yourResults = db.prepare(yourReactionsQuery).all(contactHandle, ...EXCLUDED_NUMBERS);
    const theirResults = db.prepare(theirReactionsQuery).all(contactHandle, ...EXCLUDED_NUMBERS);
    
    db.close();
    
    // Map all variants to their base reaction type (0-5)
    const typeToBaseReaction = (type) => {
      if (type >= 0 && type <= 5) return type;
      if (type >= 1000 && type <= 1005) return type - 1000;
      if (type >= 2000 && type <= 2005) return type - 2000;
      if (type === 2006) return 0; // Map 2006 to love
      return null;
    };
    
    // Define the 6 main reactions in order
    const mainReactions = [
      { type: 0, emoji: '❤️', name: 'Love' },
      { type: 1, emoji: '👍', name: 'Like' },
      { type: 2, emoji: '👎', name: 'Dislike' },
      { type: 3, emoji: '😂', name: 'Laugh' },
      { type: 4, emoji: '‼️', name: 'Emphasize' },
      { type: 5, emoji: '❓', name: 'Question' }
    ];
    
    // Aggregate your reactions by base type
    const yourAggregated = {};
    yourResults.forEach(r => {
      const baseType = typeToBaseReaction(r.type);
      if (baseType !== null) {
        yourAggregated[baseType] = (yourAggregated[baseType] || 0) + r.count;
      }
    });
    
    // Aggregate their reactions by base type
    const theirAggregated = {};
    theirResults.forEach(r => {
      const baseType = typeToBaseReaction(r.type);
      if (baseType !== null) {
        theirAggregated[baseType] = (theirAggregated[baseType] || 0) + r.count;
      }
    });
    
    // Create arrays with all 6 reactions, showing 0 for unused ones
    const yourReactions = mainReactions.map(reaction => ({
      emoji: reaction.emoji,
      type: reaction.type,
      count: yourAggregated[reaction.type] || 0
    }));
    
    const theirReactions = mainReactions.map(reaction => ({
      emoji: reaction.emoji,
      type: reaction.type,
      count: theirAggregated[reaction.type] || 0
    }));
    
    return { yourReactions, theirReactions };
    
  } catch (error) {
    console.error('Error getting contact reactions:', error);
    return { yourReactions: [], theirReactions: [] };
  }
}

/**
 * Search messages with a specific contact for a word/phrase
 */
function searchContactMessages(contactHandle, searchTerm, limit = 10, offset = 0, filter = 'both') {
  try {
    if (!cloneExists()) {
      return { count: 0, examples: [] };
    }

    const db = new Database(CLONE_DB_PATH, { readonly: true });
    
    // Handle single or multiple contact handles
    const handles = Array.isArray(contactHandle) ? contactHandle : [contactHandle];
    const handlePlaceholders = handles.map(() => '?').join(',');
    const exclusionClause = EXCLUDED_NUMBERS.map(() => '?').join(',');
    
    // Build filter clause based on sender filter
    let filterClause = '';
    if (filter === 'you') {
      filterClause = 'AND message.is_from_me = 1';
    } else if (filter === 'them') {
      filterClause = 'AND message.is_from_me = 0';
    }
    // If filter === 'both', no additional clause needed
    
    // Get count of messages containing the search term
    const countQuery = `
      SELECT COUNT(*) as count
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat ON chat_message_join.chat_id = chat.ROWID
      JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE handle.id IN (${handlePlaceholders})
        AND handle.id NOT IN (${exclusionClause})
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND message.text IS NOT NULL
        AND message.text LIKE ?
        ${filterClause}
        AND chat_message_join.chat_id IN (
          SELECT chat_id 
          FROM chat_handle_join 
          GROUP BY chat_id 
          HAVING COUNT(handle_id) = 1
        )
    `;
    
    const searchPattern = `%${searchTerm}%`;
    const countResult = db.prepare(countQuery).get(...handles, ...EXCLUDED_NUMBERS, searchPattern);
    
    // Get example messages with offset support
    const examplesQuery = `
      SELECT 
        message.text,
        message.date,
        message.is_from_me
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat ON chat_message_join.chat_id = chat.ROWID
      JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE handle.id IN (${handlePlaceholders})
        AND handle.id NOT IN (${exclusionClause})
        AND (message.associated_message_type IS NULL OR message.associated_message_type = 0)
        AND message.text IS NOT NULL
        AND message.text LIKE ?
        ${filterClause}
        AND chat_message_join.chat_id IN (
          SELECT chat_id 
          FROM chat_handle_join 
          GROUP BY chat_id 
          HAVING COUNT(handle_id) = 1
        )
      ORDER BY message.date DESC
      LIMIT ? OFFSET ?
    `;
    
    const examples = db.prepare(examplesQuery).all(...handles, ...EXCLUDED_NUMBERS, searchPattern, limit, offset);
    
    db.close();
    
    // Format the examples
    const formattedExamples = examples.map(msg => ({
      text: msg.text,
      date: msg.date,
      isFromMe: msg.is_from_me === 1,
      formattedDate: msg.date ? 
        new Date(msg.date / 1000000 + new Date('2001-01-01').getTime()).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        }) : 
        'Unknown'
    }));
    
    return {
      count: countResult.count || 0,
      examples: formattedExamples
    };
    
  } catch (error) {
    console.error('Error searching contact messages:', error);
    return { count: 0, examples: [] };
  }
}

/**
 * Get reactions for a group chat (optionally filtered by person and year)
 */
function getGroupChatReactions(chatId, personId = null, year = null) {
  try {
    if (!cloneExists()) {
      return { yourReactions: [], theirReactions: [] };
    }

    const db = new Database(CLONE_DB_PATH, { readonly: true });
    
    // Define the 6 main reactions in order
    const mainReactions = [
      { type: 0, emoji: '❤️', name: 'Love' },
      { type: 1, emoji: '👍', name: 'Like' },
      { type: 2, emoji: '👎', name: 'Dislike' },
      { type: 3, emoji: '😂', name: 'Laugh' },
      { type: 4, emoji: '‼️', name: 'Emphasize' },
      { type: 5, emoji: '❓', name: 'Question' }
    ];
    
    // Map all variants to their base reaction type (0-5)
    const typeToBaseReaction = (type) => {
      if (type >= 0 && type <= 5) return type;
      if (type >= 1000 && type <= 1005) return type - 1000;
      if (type >= 2000 && type <= 2005) return type - 2000;
      if (type === 2006) return 0; // Map 2006 to love
      return null;
    };
    
    // Build year filter
    let yearFilter = '';
    const params = [chatId];
    if (year) {
      yearFilter = `AND strftime('%Y', datetime(message.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch')) = ?`;
      params.push(year.toString());
    }
    
    // Build person filter for "their" reactions
    let personFilter = '';
    if (personId && personId !== 'all' && personId !== 'you') {
      personFilter = `AND message.handle_id IN (SELECT ROWID FROM handle WHERE id = ?)`;
      params.push(personId);
    } else if (personId === 'all') {
      personFilter = ''; // All people (not you)
    }
    
    // Get reactions you sent
    const yourReactionsQuery = `
      SELECT 
        message.associated_message_type as type,
        COUNT(*) as count
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      WHERE chat_message_join.chat_id = ?
        ${yearFilter}
        AND message.is_from_me = 1
        AND message.associated_message_type IS NOT NULL
        AND message.associated_message_type != 0
        AND message.associated_message_type != 3000
      GROUP BY message.associated_message_type
      ORDER BY count DESC
    `;
    
    // Get reactions they sent (filtered by person if specified)
    const theirReactionsQuery = `
      SELECT 
        message.associated_message_type as type,
        COUNT(*) as count
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      WHERE chat_message_join.chat_id = ?
        ${yearFilter}
        ${personFilter}
        AND message.is_from_me = 0
        AND message.associated_message_type IS NOT NULL
        AND message.associated_message_type != 0
        AND message.associated_message_type != 3000
      GROUP BY message.associated_message_type
      ORDER BY count DESC
    `;
    
    const yourResults = db.prepare(yourReactionsQuery).all(...params.slice(0, year ? 2 : 1));
    const theirParams = year ? (personFilter ? [chatId, year.toString(), personId] : [chatId, year.toString()]) : (personFilter ? [chatId, personId] : [chatId]);
    const theirResults = db.prepare(theirReactionsQuery).all(...theirParams);
    
    db.close();
    
    // Consolidate reactions by base type
    const consolidateReactions = (results) => {
      const reactionCounts = {};
      results.forEach(result => {
        const baseType = typeToBaseReaction(result.type);
        if (baseType !== null) {
          reactionCounts[baseType] = (reactionCounts[baseType] || 0) + result.count;
        }
      });
      return reactionCounts;
    };
    
    const yourConsolidated = consolidateReactions(yourResults);
    const theirConsolidated = consolidateReactions(theirResults);
    
    // Build final arrays with all 6 reactions
    const yourReactions = mainReactions.map(reaction => ({
      ...reaction,
      count: yourConsolidated[reaction.type] || 0
    }));
    
    const theirReactions = mainReactions.map(reaction => ({
      ...reaction,
      count: theirConsolidated[reaction.type] || 0
    }));
    
    return {
      yourReactions,
      theirReactions
    };
  } catch (error) {
    console.error('Error getting group chat reactions:', error);
    return { yourReactions: [], theirReactions: [] };
  }
}

module.exports = {
  checkFullDiskAccess,
  cloneChatDatabase,
  cloneContactsDatabase,
  cloneExists,
  contactsCloneExists,
  getTotalMessages,
  getMessagesByYear,
  getTopContacts,
  getTopContactsByYear,
  getSentVsReceived,
  getAllWords,
  getMostActiveYear,
  getAverageMessagesPerDay,
  getAllStats,
  getContactInfo,
  testContactsDatabase,
  saveContactsCSV,
  loadContactsCSV,
  contactsCSVExists,
  getAvailableYears,
  getTopGroupChats,
  getTopGroupChatsByYear,
  getGroupChatStats,
  getGroupChatParticipants,
  getGroupChatWords,
  getGroupChatEmojis,
  searchGroupChatMessages,
  getGroupChatReactions,
  getContactStats,
  getContactStatsByYear,
  getContactWords,
  getContactWordsByYear,
  getContactEmojis,
  getContactEmojisByYear,
  getCombinedContactStats,
  getCombinedContactWords,
  getCombinedContactEmojis,
  getCombinedContactStatsByYear,
  getCombinedContactWordsByYear,
  getCombinedContactEmojisByYear,
  getContactReactions,
  searchContactMessages,
  CLONE_DB_PATH,
  CONTACTS_CLONE_PATH
};
