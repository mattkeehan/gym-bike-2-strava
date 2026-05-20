import Head from 'next/head';
import Link from 'next/link';

export default function Terms() {
  return (
    <>
      <Head>
        <title>Terms of Service - Photo2Strava</title>
        <meta name="description" content="Terms of Service for Photo2Strava" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png?v=2" />
      </Head>

      <main style={styles.main}>
        <div style={styles.container}>
          <h1 style={styles.title}>Terms of Service</h1>
          <p style={styles.date}>Last updated: May 20, 2026</p>

          <section style={styles.section}>
            <h2 style={styles.heading}>Overview</h2>
            <p style={styles.paragraph}>
              Welcome to Photo2Strava! By using this service at <a href="https://photo2strava.com" style={styles.link}>https://photo2strava.com</a>, 
              you agree to these terms. Photo2Strava helps you convert workout screen photos 
              (from gym bikes or treadmills) into Strava activities using AI extraction.
            </p>
            <p style={styles.paragraph}>
              If you don't agree with these terms, please don't use the service.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.heading}>What You Can Expect</h2>
            <p style={styles.paragraph}>
              Photo2Strava provides:
            </p>
            <ul style={styles.list}>
              <li style={styles.listItem}>AI-powered extraction of workout data from photos</li>
              <li style={styles.listItem}>1 free AI extraction per day</li>
              <li style={styles.listItem}>The ability to upload workouts to your Strava account</li>
              <li style={styles.listItem}>Manual editing of extracted workout data</li>
            </ul>
          </section>

          <section style={styles.section}>
            <h2 style={styles.heading}>Usage Expectations</h2>
            <p style={styles.paragraph}>
              When using Photo2Strava:
            </p>
            <ul style={styles.list}>
              <li style={styles.listItem}>
                <strong>Ownership:</strong> Only upload photos you own or have permission to use
              </li>
              <li style={styles.listItem}>
                <strong>Accuracy:</strong> You are responsible for reviewing extracted data before 
                uploading to Strava
              </li>
              <li style={styles.listItem}>
                <strong>Your Account:</strong> Workouts uploaded to Strava appear under your account. 
                You're responsible for what gets uploaded.
              </li>
              <li style={styles.listItem}>
                <strong>Fair Use:</strong> Don't abuse the service with excessive requests, automation, 
                or attempts to circumvent usage limits
              </li>
            </ul>
          </section>

          <section style={styles.section}>
            <h2 style={styles.heading}>AI Extraction Limitations</h2>
            <p style={styles.paragraph}>
              Our AI does its best, but it's not perfect:
            </p>
            <ul style={styles.list}>
              <li style={styles.listItem}>
                Extraction accuracy depends on photo quality and screen layout
              </li>
              <li style={styles.listItem}>
                The AI may occasionally misread numbers or fail to extract data
              </li>
              <li style={styles.listItem}>
                Always review extracted metrics before uploading to Strava
              </li>
              <li style={styles.listItem}>
                You can manually edit data if the AI gets something wrong
              </li>
            </ul>
          </section>

          <section style={styles.section}>
            <h2 style={styles.heading}>Service Availability</h2>
            <p style={styles.paragraph}>
              Photo2Strava is provided "as-is":
            </p>
            <ul style={styles.list}>
              <li style={styles.listItem}>
                We make no guarantees about uptime or availability
              </li>
              <li style={styles.listItem}>
                The service may be modified, suspended, or discontinued at any time
              </li>
              <li style={styles.listItem}>
                Usage limits (like the 1-per-day free extraction) may change
              </li>
              <li style={styles.listItem}>
                Features may be added, removed, or changed without notice
              </li>
            </ul>
          </section>

          <section style={styles.section}>
            <h2 style={styles.heading}>Strava Integration</h2>
            <p style={styles.paragraph}>
              When you connect your Strava account:
            </p>
            <ul style={styles.list}>
              <li style={styles.listItem}>
                You authorize Photo2Strava to upload workout files on your behalf
              </li>
              <li style={styles.listItem}>
                Strava's own terms and policies apply to uploaded activities
              </li>
              <li style={styles.listItem}>
                You can disconnect your account at any time through Strava settings
              </li>
              <li style={styles.listItem}>
                We're not responsible for issues with the Strava API or your Strava account
              </li>
            </ul>
          </section>

          <section style={styles.section}>
            <h2 style={styles.heading}>Prohibited Activities</h2>
            <p style={styles.paragraph}>
              Please don't:
            </p>
            <ul style={styles.list}>
              <li style={styles.listItem}>Attempt to reverse-engineer or scrape the service</li>
              <li style={styles.listItem}>Use automation to bypass usage limits</li>
              <li style={styles.listItem}>Upload content that violates others' rights</li>
              <li style={styles.listItem}>Interfere with the service's operation or security</li>
              <li style={styles.listItem}>Use the service for any illegal purpose</li>
            </ul>
          </section>

          <section style={styles.section}>
            <h2 style={styles.heading}>Liability & Disclaimers</h2>
            <p style={styles.paragraph}>
              Use Photo2Strava at your own risk:
            </p>
            <ul style={styles.list}>
              <li style={styles.listItem}>
                The service is provided "as-is" without warranties of any kind
              </li>
              <li style={styles.listItem}>
                We're not liable for incorrect workout data or Strava upload issues
              </li>
              <li style={styles.listItem}>
                We're not responsible for data loss, service interruptions, or errors
              </li>
              <li style={styles.listItem}>
                You assume all risks associated with using the service
              </li>
            </ul>
            <p style={styles.paragraph}>
              In simple terms: we built this tool to be helpful, but we can't guarantee perfection. 
              Always double-check your workout data before uploading to Strava.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.heading}>Changes to These Terms</h2>
            <p style={styles.paragraph}>
              We may update these terms occasionally. Continued use of the service after changes 
              means you accept the updated terms. Material changes will be noted by updating 
              the "Last updated" date above.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.heading}>Contact</h2>
            <p style={styles.paragraph}>
              Questions or concerns? Reach out on LinkedIn: <a href="https://www.linkedin.com/in/matt-keehan-5910714/" style={styles.link} target="_blank" rel="noopener noreferrer">Matt Keehan</a>
            </p>
          </section>

          <footer style={styles.footer}>
            <Link href="/" style={styles.footerLink}>← Back to Home</Link>
            <span style={styles.separator}>•</span>
            <Link href="/privacy" style={styles.footerLink}>Privacy Policy</Link>
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
