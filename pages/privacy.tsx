import Head from 'next/head';
import Link from 'next/link';

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy - Photo2Strava</title>
        <meta name="description" content="Privacy Policy for Photo2Strava" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png?v=2" />
      </Head>

      <main style={styles.main}>
        <div style={styles.container}>
          <h1 style={styles.title}>Privacy Policy</h1>
          <p style={styles.date}>Last updated: May 20, 2026</p>

          <section style={styles.section}>
            <h2 style={styles.heading}>Overview</h2>
            <p style={styles.paragraph}>
              Photo2Strava (<a href="https://photo2strava.com" style={styles.link}>https://photo2strava.com</a>) 
              is a simple tool that helps you convert workout screen photos into Strava activities. 
              You upload a photo of your gym bike or treadmill workout summary screen, our AI extracts 
              the workout data, and you can send it to your Strava account.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.heading}>Data Collection & Usage</h2>
            <p style={styles.paragraph}>
              When you use Photo2Strava:
            </p>
            <ul style={styles.list}>
              <li style={styles.listItem}>
                <strong>Uploaded Photos:</strong> Images you upload are processed temporarily to extract 
                workout data. Photos are not permanently stored on our servers and are discarded after processing.
              </li>
              <li style={styles.listItem}>
                <strong>Workout Data:</strong> Extracted workout metrics (duration, watts, pace, etc.) may be 
                temporarily processed in memory or serverless functions but are not stored in a database.
              </li>
              <li style={styles.listItem}>
                <strong>Usage Limits:</strong> We use browser localStorage to track your daily free AI extraction 
                limit (1 per day). This data stays on your device and is not sent to our servers.
              </li>
            </ul>
          </section>

          <section style={styles.section}>
            <h2 style={styles.heading}>Strava Integration</h2>
            <p style={styles.paragraph}>
              If you choose to connect your Strava account:
            </p>
            <ul style={styles.list}>
              <li style={styles.listItem}>
                You explicitly authorize Photo2Strava to upload workouts to your Strava account
              </li>
              <li style={styles.listItem}>
                We only request the minimum permissions needed to upload workout files
              </li>
              <li style={styles.listItem}>
                We do not access, read, or store your other Strava activities or personal data
              </li>
              <li style={styles.listItem}>
                You can revoke access at any time through your Strava account settings
              </li>
            </ul>
          </section>

          <section style={styles.section}>
            <h2 style={styles.heading}>Third-Party Services</h2>
            <p style={styles.paragraph}>
              Photo2Strava uses the following third-party services:
            </p>
            <ul style={styles.list}>
              <li style={styles.listItem}>
                <strong>Vercel:</strong> Hosting and serverless infrastructure
              </li>
              <li style={styles.listItem}>
                <strong>Vercel AI Gateway:</strong> AI-powered workout data extraction
              </li>
              <li style={styles.listItem}>
                <strong>Strava API:</strong> Uploading workouts to your Strava account
              </li>
            </ul>
            <p style={styles.paragraph}>
              Each service has its own privacy policy. We recommend reviewing them if you have concerns 
              about how they handle data.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.heading}>Cookies & Analytics</h2>
            <p style={styles.paragraph}>
              We may use basic analytics to understand usage patterns and improve the service. 
              We use localStorage to track your daily AI usage limit and maintain your user experience.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.heading}>Data Security</h2>
            <p style={styles.paragraph}>
              We take reasonable measures to protect your data. However, no internet transmission 
              is 100% secure. Photos are processed on-demand and not retained. Strava OAuth tokens 
              are handled according to OAuth 2.0 best practices.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.heading}>Your Rights</h2>
            <p style={styles.paragraph}>
              Since we don't store your photos or workout data permanently, there's minimal personal 
              information to manage. If you have connected your Strava account, you can disconnect 
              it at any time through Strava's settings.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.heading}>Changes to This Policy</h2>
            <p style={styles.paragraph}>
              We may update this privacy policy occasionally. Changes will be posted on this page 
              with an updated "Last updated" date.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.heading}>Contact</h2>
            <p style={styles.paragraph}>
              Questions about privacy? Reach out on LinkedIn: <a href="https://www.linkedin.com/in/matt-keehan-5910714/" style={styles.link} target="_blank" rel="noopener noreferrer">Matt Keehan</a>
            </p>
          </section>

          <footer style={styles.footer}>
            <Link href="/" style={styles.footerLink}>← Back to Home</Link>
            <span style={styles.separator}>•</span>
            <Link href="/terms" style={styles.footerLink}>Terms of Service</Link>
          </footer>
        </div>
      </main>
    </>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  main: {
    minHeight: '100vh',
    padding: '2rem 1rem',
    backgroundColor: '#f5f5f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    backgroundColor: 'white',
    padding: '3rem 2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
    color: '#333',
  },
  date: {
    color: '#999',
    fontSize: '0.9rem',
    marginBottom: '2rem',
  },
  section: {
    marginBottom: '2.5rem',
  },
  heading: {
    fontSize: '1.5rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: '#333',
  },
  paragraph: {
    lineHeight: '1.7',
    color: '#555',
    marginBottom: '1rem',
  },
  list: {
    lineHeight: '1.8',
    color: '#555',
    paddingLeft: '1.5rem',
  },
  listItem: {
    marginBottom: '0.75rem',
  },
  link: {
    color: '#FC4C02',
    textDecoration: 'none',
  },
  footer: {
    marginTop: '3rem',
    paddingTop: '2rem',
    borderTop: '1px solid #eee',
    textAlign: 'center',
    fontSize: '0.95rem',
  },
  footerLink: {
    color: '#FC4C02',
    textDecoration: 'none',
  },
  separator: {
    margin: '0 1rem',
    color: '#ccc',
  },
};
