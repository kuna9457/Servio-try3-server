import jwt from 'jsonwebtoken';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      console.log('No token provided in request');
      return res.status(401).json({ message: 'No token provided' });
    }

    console.log('Verifying token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    if (!decoded || !decoded.userId) {
      console.log('Invalid token format:', decoded);
      return res.status(401).json({ message: 'Invalid token format' });
    }

    console.log('Token verified successfully for user:', decoded.userId);
    console.log('Decoded token structure:', JSON.stringify(decoded, null, 2));
    
    // Make sure req.user has the correct structure
    req.user = {
      id: decoded.userId,
      ...decoded
    };
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    if (error.name === 'TokenExpiredError') {
      console.log('Token has expired');
      return res.status(401).json({ message: 'Token has expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      console.log('Invalid token:', error.message);
      return res.status(401).json({ message: 'Invalid token' });
    }
    return res.status(401).json({ message: 'Authentication failed' });
  }
};

export const isAdmin = async (req, res, next) => {
  try {
    // Check if user exists and has admin role
    if (!req.user) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Authentication required.'
      });
    }

    // Check for system admin (hardcoded admin)
    if (req.user.isSystemAdmin && req.user.role === 'admin') {
      return next();
    }

    // Check for regular admin users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      });
    }
    
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}; 