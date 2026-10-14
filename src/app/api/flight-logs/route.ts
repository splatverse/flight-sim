import { NextRequest, NextResponse } from 'next/server';
import clientPromise, { isMongoConfigured } from '@/lib/mongodb';

// GET: Retrieve top flight logs/leaderboard
export async function GET() {
  if (!isMongoConfigured) {
    return NextResponse.json({
      success: true,
      localMode: true,
      logs: [],
    });
  }

  try {
    const client = await clientPromise;
    const db = client.db('flight_simulator');
    const logsCollection = db.collection('flight_logs');

    // Retrieve the top 20 records sorted by score descending
    const logs = await logsCollection
      .find({})
      .sort({ score: -1, date: -1 })
      .limit(20)
      .toArray();

    return NextResponse.json({
      success: true,
      localMode: false,
      logs,
    });
  } catch (error: any) {
    console.error('Error fetching from MongoDB:', error);
    return NextResponse.json({
      success: false,
      localMode: true,
      error: error.message || 'Database error',
      logs: [],
    });
  }
}

// POST: Save a new flight log
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { aircraft, mode, score, ringsCollected, flightTime, landed, date } = body;

    // Validate request body
    if (!aircraft || !mode || score === undefined || flightTime === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required flight log fields' },
        { status: 400 }
      );
    }

    const newLog = {
      aircraft,
      mode,
      score: Number(score),
      ringsCollected: Number(ringsCollected || 0),
      flightTime: Number(flightTime),
      landed: Boolean(landed),
      date: date || new Date().toISOString(),
    };

    if (!isMongoConfigured) {
      return NextResponse.json({
        success: true,
        localMode: true,
        log: newLog,
        message: 'Saved locally (Local Mode)',
      });
    }

    const client = await clientPromise;
    const db = client.db('flight_simulator');
    const logsCollection = db.collection('flight_logs');

    const result = await logsCollection.insertOne(newLog);

    return NextResponse.json({
      success: true,
      localMode: false,
      log: {
        ...newLog,
        _id: result.insertedId,
      },
    });
  } catch (error: any) {
    console.error('Error saving to MongoDB:', error);
    return NextResponse.json({
      success: false,
      localMode: true,
      error: error.message || 'Database error',
      message: 'MongoDB unavailable, fell back to local storage routing',
    });
  }
}
