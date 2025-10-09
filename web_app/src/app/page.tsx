'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  assets?: GitHubAsset[];
}

function HomeContent() {
  const searchParams = useSearchParams();
  const isUpdate = searchParams.get('update') !== null;
  const [downloadUrl, setDownloadUrl] = useState('https://github.com/FO214/remess/releases/latest');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Fetch the latest release info from GitHub API
    fetch('https://api.github.com/repos/FO214/remess/releases/latest')
      .then(res => res.json())
      .then((data: GitHubRelease) => {
        // Find the .dmg asset
        const dmgAsset = data.assets?.find((asset: GitHubAsset) => asset.name.endsWith('.dmg'));
        if (dmgAsset) {
          setDownloadUrl(dmgAsset.browser_download_url);
        }
      })
      .catch(err => {
        console.error('Failed to fetch latest release:', err);
      });
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText('xattr -cr /Applications/Remess.app');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="landing-container">
      {/* Floating Messages Background */}
      <div className="bubbles-container">
        <div className="bubble bubble-1">bestie you need help 💀</div>
        <div className="bubble bubble-2">JAIL. straight to jail 🚔</div>
        <div className="bubble bubble-3">this is CRIMINAL behavior 😭</div>
        <div className="bubble bubble-4">seek professional help fr 🛋️</div>
        <div className="bubble bubble-5">absolutely FERAL energy 🐺</div>
        <div className="bubble bubble-6">unmedicated behavior 💊</div>
        <div className="bubble bubble-7">the audacity is INSANE 😤</div>
        <div className="bubble bubble-8">down HORRENDOUS 🫣</div>
        <div className="bubble bubble-9">embarrassing. mortifying 😬</div>
        <div className="bubble bubble-10">this is a CRY for help 📢</div>
        <div className="bubble bubble-11">absolutely DERANGED 🤪</div>
        <div className="bubble bubble-12">no self control detected 🚨</div>
        <div className="bubble bubble-13">UNWELL behavior 🤒</div>
        <div className="bubble bubble-14">the DELUSION is real ✨</div>
        <div className="bubble bubble-15">seek GOD immediately 🙏</div>
        <div className="bubble bubble-16">chronically DELUSIONAL 🎭</div>
        <div className="bubble bubble-17">absolutely MAIDENLESS 👻</div>
        <div className="bubble bubble-18">zero chill detected ❄️</div>
        <div className="bubble bubble-19">TOUCH GRASS NOW 🌱</div>
        <div className="bubble bubble-20">the AUDACITY 😤</div>
        <div className="bubble bubble-21">YIKES on bikes 🚴</div>
        <div className="bubble bubble-22">red flag FACTORY 🚩</div>
        <div className="bubble bubble-23">absolutely UNHINGED 🔓</div>
        <div className="bubble bubble-24">MENACE to society 👹</div>
        <div className="bubble bubble-25">this ain&apos;t it chief 🫡</div>
        <div className="bubble bubble-26">CATASTROPHIC choices 💥</div>
        <div className="bubble bubble-27">absolutely SHAMELESS 😈</div>
        <div className="bubble bubble-28">VIOLATION detected 🚫</div>
        <div className="bubble bubble-29">the DISRESPECT 😤</div>
        <div className="bubble bubble-30">absolutely DEMENTED 🤡</div>
        <div className="bubble bubble-31">UNSERIOUS behavior 🎪</div>
        <div className="bubble bubble-32">the CHAOS is real 🌪️</div>
        <div className="bubble bubble-33">FOUL behavior 🤢</div>
        <div className="bubble bubble-34">absolutely DIABOLICAL 😈</div>
        <div className="bubble bubble-35">NASTY work 🤮</div>
        <div className="bubble bubble-36">the NERVE of you 😠</div>
        <div className="bubble bubble-37">CLOWNERY at its finest 🤡</div>
        <div className="bubble bubble-38">absolutely VILE 🤢</div>
        <div className="bubble bubble-39">HEINOUS activity 😱</div>
        <div className="bubble bubble-40">the GALL 😤</div>
        <div className="bubble bubble-41">absolutely BONKERS 🥴</div>
        <div className="bubble bubble-42">WILD behavior 🦁</div>
        <div className="bubble bubble-43">INSANE in the membrane 🧠</div>
        <div className="bubble bubble-44">absolutely RABID 🐕</div>
        <div className="bubble bubble-45">FERAL cat energy 🐈</div>
        <div className="bubble bubble-46">PSYCHOTIC behavior 😵</div>
        <div className="bubble bubble-47">absolutely BATSHIT 🦇</div>
        <div className="bubble bubble-48">MANIAC energy 🤪</div>
        <div className="bubble bubble-49">absolutely CRACKED 🥚</div>
        <div className="bubble bubble-50">LUNATIC behavior 🌙</div>
      </div>

      {/* Hero Section */}
      <div className="hero-section">
        <div className="hero-content">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="Remess" className="landing-logo" />
          <h1 className="landing-title">Remess</h1>
          <p className="landing-subtitle">Your LIFE in Texts</p>
          <p className="landing-description">
            {isUpdate 
              ? 'Get the latest features and improvements for your messaging story.'
              : 'Discover your messaging story. Every conversation. Every moment. All your texts.'
            }
          </p>
          
          <a 
            href={downloadUrl}
            className="download-button"
            download
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/>
            </svg>
            {isUpdate ? 'Get Latest Version' : 'Download Latest Version'}
          </a>

          <p className="compatibility-note">Apple Silicon • macOS 11+</p>

          {/* Scroll Indicator */}
          <div className="scroll-indicator">
            <span>{isUpdate ? 'Scroll for update instructions' : 'Scroll for setup'}</span>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="setup-container">
        <div className="setup-section">
          <h2 className="setup-title">{isUpdate ? 'Update Instructions' : 'Setup Instructions'}</h2>
          
          {isUpdate ? (
            // Update instructions
            <>
              <div className="setup-block">
                <div className="setup-steps">
                  <div className="setup-step">
                    <div className="step-number">1</div>
                    <div className="step-content">
                      <h3>Close Remess</h3>
                      <p>Make sure Remess is completely closed before updating</p>
                    </div>
                  </div>

                  <div className="setup-step">
                    <div className="step-number">2</div>
                    <div className="step-content">
                      <h3>Replace with New Version</h3>
                      <p>Download and drag the new version to your Applications folder, replacing the existing app</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="setup-block">
                <div className="setup-steps">
                  <div className="setup-step">
                    <div className="step-number">3</div>
                    <div className="step-content">
                      <h3>Allow the Updated App to Run</h3>
                      <p>Open Terminal and run this command to allow the updated app:</p>
                      <div className="code-block">
                        <code>xattr -cr /Applications/Remess.app</code>
                        <button 
                          className={`copy-button ${copied ? 'copied' : ''}`}
                          onClick={handleCopy}
                        >
                          {copied ? (
                            <>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                              Copied!
                            </>
                          ) : (
                            'Copy'
                          )}
                        </button>
                      </div>
                      <div className="tutorial-media">
                        <video 
                          autoPlay 
                          loop 
                          muted 
                          playsInline
                          className="tutorial-video"
                          src="/tutorials/step2.mov"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="setup-step">
                    <div className="step-number">4</div>
                    <div className="step-content">
                      <h3>You&apos;re All Set!</h3>
                      <p>Launch Remess and enjoy the latest features. Your data is preserved automatically.</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            // First-time setup instructions
            <>
              <div className="setup-block">
                <div className="setup-steps">
                  <div className="setup-step">
                    <div className="step-number">1</div>
                    <div className="step-content">
                      <h3>Download & Install</h3>
                      <p>Download Remess and drag it to your Applications folder</p>
                    </div>
                  </div>

                  <div className="setup-step">
                    <div className="step-number">2</div>
                    <div className="step-content">
                      <h3>Allow the App to Run</h3>
                      <p>Open Terminal (⌘ + Space, type &quot;Terminal&quot;), paste this command, and press Enter:</p>
                      <div className="code-block">
                        <code>xattr -cr /Applications/Remess.app</code>
                        <button 
                          className={`copy-button ${copied ? 'copied' : ''}`}
                          onClick={handleCopy}
                        >
                          {copied ? (
                            <>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                              Copied!
                            </>
                          ) : (
                            'Copy'
                          )}
                        </button>
                      </div>
                      <div className="tutorial-media">
                        <video 
                          autoPlay 
                          loop 
                          muted 
                          playsInline
                          className="tutorial-video"
                          src="/tutorials/step2.mov"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="setup-block">
                <div className="setup-steps">
                  <div className="setup-step">
                    <div className="step-number">3</div>
                    <div className="step-content">
                      <h3>Grant Full Disk Access</h3>
                      <p>Open System Settings → Privacy & Security → Full Disk Access</p>
                      <p className="step-detail">Click the + button to add Remess to the list</p>
                      <div className="tutorial-media">
                        <video 
                          autoPlay 
                          loop 
                          muted 
                          playsInline
                          className="tutorial-video"
                          src="/tutorials/step3.mov"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="setup-step">
                    <div className="step-number">4</div>
                    <div className="step-content">
                      <h3>Import Your Contacts</h3>
                      <p>Export contacts from the Contacts app:</p>
                      <ul className="step-list">
                        <li>Open Contacts app</li>
                        <li>Select all contacts (⌘+A)</li>
                        <li>File → Export vCard...</li>
                        <li>Upload the .vcf file into Remess</li>
                      </ul>
                      <div className="tutorial-media">
                        <video 
                          autoPlay 
                          loop 
                          muted 
                          playsInline
                          className="tutorial-video"
                          src="/tutorials/step4.mov"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="setup-block">
                <div className="setup-steps">
                  <div className="setup-step">
                    <div className="step-number">5</div>
                    <div className="step-content">
                      <h3>Enjoy Your Story!</h3>
                      <p>Remess will analyze your messages and show you amazing insights about your texting habits</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Privacy Note */}
        <div className="privacy-note">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <span>100% Private. All data stays on your device. Nothing is ever uploaded.</span>
        </div>

        {/* Footer */}
        <footer className="landing-footer">
          <p>Made with ❤️ for your messaging story</p>
          <div className="footer-links">
            <a href="https://github.com/FO214/remess" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <span>•</span>
            <a href="https://github.com/FO214/remess/issues" target="_blank" rel="noopener noreferrer">
              Support
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="landing-container">
        <div className="hero-section">
          <div className="hero-content">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.png" alt="Remess" className="landing-logo" />
            <h1 className="landing-title">Remess</h1>
            <p className="landing-subtitle">Your LIFE in Texts</p>
          </div>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}