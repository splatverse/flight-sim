import { NextRequest, NextResponse } from 'next/server';
import clientPromise, { isMongoConfigured } from '@/lib/mongodb';
import { verifyPassword } from '@/lib/password';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { usernameOrEmail, password } = body;

    // 1. Basic validation
    if (!usernameOrEmail || !password) {
      return NextResponse.json(
        { success: false, error: 'Both username/email and password are required.' },
        { status: 400 }
      );
    }

    // 2. Local Mode Fallback
    if (!isMongoConfigured) {
      return NextResponse.json({
        success: true,
        localMode: true,
        message: 'Authenticate against client-side localStorage (Local Mode).'
      });
    }

    // 3. Database operation
    const client = await clientPromise;
    const db = client.db('flight_simulator');
    const usersCollection = db.collection('users');

    const searchKey = usernameOrEmail.toLowerCase();
    
    // Find user by username or email
    const user = await usersCollection.findOne({
      $or: [
        { email: searchKey },
        { username: searchKey }
      ]
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid username/email or password.' },
        { status: 401 }
      );
    }

    // Verify Password
    const isValid = verifyPassword(password, user.salt, user.hash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid username/email or password.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      localMode: false,
      user: {
        name: user.name,
        email: user.email,
        username: user.username
      }
    });
  } catch (error: any) {
    console.error('Login Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'An error occurred during authentication.' },
      { status: 500 }
    );
  }
}
