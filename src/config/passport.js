const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const userModel = require('../models/user');

// Only setup GitHub strategy if environment variables are provided
if (process.env.GH_CLIENT_ID && process.env.GH_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
      clientID: process.env.GH_CLIENT_ID,
      clientSecret: process.env.GH_CLIENT_SECRET,
      callbackURL: process.env.GH_CALLBACK_URL,
      scope: ['user:email', 'repo']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const { id, displayName, emails, avatar_url } = profile;
        const email = emails && emails[0] ? emails[0].value : null;

        if (!email) {
          return done(null, false, { message: 'Geen e-mailadres beschikbaar van GitHub' });
        }

        // Check if user exists by GitHub ID
        let user = await userModel.getUserByGithubId(id.toString());

        if (user) {
          // User exists, update access token
          user = await userModel.updateUserGithubAccessToken(user.id, accessToken);
          return done(null, user);
        }

        // Check if user exists by email
        user = await userModel.getUserByEmail(email);

        if (user) {
          // User exists, link GitHub ID and access token
          user = await userModel.updateUserGithubId(user.id, id.toString());
          user = await userModel.updateUserGithubAccessToken(user.id, accessToken);
          return done(null, user);
        }

        // Create new user
        user = await userModel.createUser({
          email,
          name: displayName || email.split('@')[0],
          github_id: id.toString(),
          github_access_token: accessToken,
          password_hash: null,
          role: 'student'
        });

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  ));
} else {
  console.warn('⚠️  GitHub OAuth not configured. Set GH_CLIENT_ID and GH_CLIENT_SECRET to enable GitHub login.');
}

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await userModel.getUserById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

module.exports = passport;
