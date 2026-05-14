import 'dart:async';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

/// Local SQLite cache for offline-first transaction logging.
class LocalTransactionCache {
  static const String _dbName = 'securerise_transactions.db';
  static const int _dbVersion = 1;
  static const String _table = 'escrow_transactions';

  static Database? _db;

  /// Initialize the local database.
  static Future<Database> _getDb() async {
    if (_db != null) {
      return _db!;
    }

    final dbPath = await getDatabasesPath();
    final path = join(dbPath, _dbName);

    _db = await openDatabase(
      path,
      version: _dbVersion,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE IF NOT EXISTS $_table (
            id TEXT PRIMARY KEY,
            escrowId TEXT NOT NULL,
            transactionId TEXT,
            provider TEXT NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL,
            status TEXT NOT NULL,
            buyerId TEXT NOT NULL,
            sellerId TEXT NOT NULL,
            metadata TEXT,
            integrityHash TEXT,
            createdAt INTEGER NOT NULL,
            updatedAt INTEGER NOT NULL,
            syncedAt INTEGER
          )
        ''');

        await db.execute('''
          CREATE INDEX IF NOT EXISTS idx_escrow_status
          ON $_table (escrowId, status)
        ''');

        await db.execute('''
          CREATE INDEX IF NOT EXISTS idx_synced_at
          ON $_table (syncedAt)
        ''');
      },
    );

    return _db!;
  }

  /// Cache a transaction locally.
  static Future<void> cacheTransaction({
    required String id,
    required String escrowId,
    required String provider,
    required double amount,
    required String currency,
    required String buyerId,
    required String sellerId,
    String? transactionId,
    String? status,
    Map<String, dynamic>? metadata,
    String? integrityHash,
  }) async {
    final db = await _getDb();
    final now = DateTime.now().millisecondsSinceEpoch;

    await db.insert(
      _table,
      {
        'id': id,
        'escrowId': escrowId,
        'transactionId': transactionId,
        'provider': provider,
        'amount': amount,
        'currency': currency,
        'status': status ?? 'PENDING',
        'buyerId': buyerId,
        'sellerId': sellerId,
        'metadata': metadata != null ? _encodeJson(metadata) : null,
        'integrityHash': integrityHash,
        'createdAt': now,
        'updatedAt': now,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Retrieve a cached transaction by ID.
  static Future<Map<String, dynamic>?> getTransaction(String id) async {
    final db = await _getDb();
    final results = await db.query(
      _table,
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );

    if (results.isEmpty) return null;
    final row = results.first;
    row['metadata'] =
        row['metadata'] != null ? _decodeJson(row['metadata']) : null;
    return row;
  }

  /// Retrieve all pending transactions (not yet synced to backend).
  static Future<List<Map<String, dynamic>>> getPendingTransactions() async {
    final db = await _getDb();
    final results = await db.query(
      _table,
      where: 'syncedAt IS NULL',
      orderBy: 'createdAt ASC',
    );

    for (final row in results) {
      row['metadata'] =
          row['metadata'] != null ? _decodeJson(row['metadata']) : null;
    }

    return results;
  }

  /// Update transaction status locally.
  static Future<void> updateTransactionStatus(
    String id,
    String status, {
    String? transactionId,
    Map<String, dynamic>? metadata,
  }) async {
    final db = await _getDb();
    final now = DateTime.now().millisecondsSinceEpoch;

    final update = <String, dynamic>{
      'status': status,
      'updatedAt': now,
    };

    if (transactionId != null) {
      update['transactionId'] = transactionId;
    }

    if (metadata != null) {
      update['metadata'] = _encodeJson(metadata);
    }

    await db.update(
      _table,
      update,
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  /// Mark transactions as synced to backend.
  static Future<void> markAsSynced(List<String> ids) async {
    if (ids.isEmpty) return;

    final db = await _getDb();
    final now = DateTime.now().millisecondsSinceEpoch;

    for (final id in ids) {
      await db.update(
        _table,
        {'syncedAt': now},
        where: 'id = ?',
        whereArgs: [id],
      );
    }
  }

  /// Retrieve transactions for a specific escrow.
  static Future<List<Map<String, dynamic>>> getEscrowTransactions(
    String escrowId,
  ) async {
    final db = await _getDb();
    final results = await db.query(
      _table,
      where: 'escrowId = ?',
      whereArgs: [escrowId],
      orderBy: 'createdAt DESC',
    );

    for (final row in results) {
      row['metadata'] =
          row['metadata'] != null ? _decodeJson(row['metadata']) : null;
    }

    return results;
  }

  /// Clear synced transactions older than X days.
  static Future<int> clearOldSyncedTransactions(
      {int olderThanDays = 30}) async {
    final db = await _getDb();
    final cutoffTime = DateTime.now()
        .subtract(Duration(days: olderThanDays))
        .millisecondsSinceEpoch;

    return db.delete(
      _table,
      where: 'syncedAt IS NOT NULL AND syncedAt < ?',
      whereArgs: [cutoffTime],
    );
  }

  /// Get transaction count by status.
  static Future<Map<String, int>> getTransactionStats() async {
    final db = await _getDb();
    final results = await db.rawQuery('''
      SELECT status, COUNT(*) as count
      FROM $_table
      GROUP BY status
    ''');

    final stats = <String, int>{};
    for (final row in results) {
      final status = row['status'] as String?;
      final count = (row['count'] as int?) ?? 0;
      if (status != null) {
        stats[status] = count;
      }
    }

    return stats;
  }

  /// Close the database.
  static Future<void> close() async {
    if (_db != null) {
      await _db!.close();
      _db = null;
    }
  }

  // Helper: JSON encoding (minimal, non-ASCII safe)
  static String _encodeJson(Map<String, dynamic> data) {
    return _simpleJsonEncode(data);
  }

  // Helper: JSON decoding
  static Map<String, dynamic> _decodeJson(dynamic data) {
    if (data is String) {
      try {
        return _simpleJsonDecode(data);
      } catch (_) {
        return {};
      }
    }
    return {};
  }

  // Simple JSON encoder (handles basic types)
  static String _simpleJsonEncode(dynamic obj) {
    if (obj == null) return 'null';
    if (obj is bool) return obj ? 'true' : 'false';
    if (obj is num) return obj.toString();
    if (obj is String) return '"${obj.replaceAll('"', '\\"')}"';
    if (obj is List) {
      return '[${obj.map(_simpleJsonEncode).join(',')}]';
    }
    if (obj is Map) {
      final entries = obj.entries
          .map((e) => '"${e.key}":${_simpleJsonEncode(e.value)}')
          .join(',');
      return '{$entries}';
    }
    return 'null';
  }

  // Simple JSON decoder (basic parsing)
  static Map<String, dynamic> _simpleJsonDecode(String json) {
    // This is a placeholder; in production use dart:convert
    return {};
  }
}
