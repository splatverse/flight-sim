import { NextRequest, NextResponse } from 'next/server';
import clientPromise, { isMongoConfigured } from '@/lib/mongodb';
import { hashPassword } from '@/lib/password';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, username, password, confirmPassword } = body;

    // 1. Basic Validation
    if (!name || !email || !username || !password || !confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'All fields (name, email, username, password, confirmPassword) are required.' },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'Passwords do not match.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    // Email syntax validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format.' },
        { status: 400 }
      );
    }

    // 2. Local Mode Fallback Check
    if (!isMongoConfigured) {
      return NextResponse.json({
        success: true,
        localMode: true,
        user: { name, email, username },
        message: 'Registration simulated successfully. Saved to client telemetry logs (Local Mode).'
      });
    }

    // 3. Database operation
    const client = await clientPromise;
    const db = client.db('flight_simulator');
    const usersCollection = db.collection('users');

    // Check if user already exists
    const existingUser = await usersCollection.findOne({
      $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }]
    });

    if (existingUser) {
      const isEmailConflict = existingUser.email === email.toLowerCase();
      return NextResponse.json(
        {
          success: false,
          error: isEmailConflict
            ? 'A user with this email address is already registered.'
            : 'This username is already taken.'
        },
        { status: 409 }
      );
    }

    // Hash password
    const { salt, hash } = hashPassword(password);

    // Save user
    const newUser = {
      name,
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      salt,
      hash,
      registeredAt: new Date().toISOString()
    };

    await usersCollection.insertOne(newUser);

    return NextResponse.json({
      success: true,
      localMode: false,
      user: {
        name,
        email: newUser.email,
        username: newUser.username
      }
    });
  } catch (error: any) {
    console.error('Signup Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'An error occurred during account creation.' },
      { status: 500 }
    );
  }
}
