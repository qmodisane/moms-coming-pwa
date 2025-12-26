import QRCode from 'qrcode';

class QRCodeService {
  /**
   * Generate QR code for app installation + auto-join game
   * URL format: https://your-domain.com/?join=SESSION_CODE
   */
  async generateGameJoinQR(sessionCode) {
    const appUrl = window.location.origin;
    const joinUrl = `${appUrl}/?join=${sessionCode}`;
    
    try {
      // Generate QR code as data URL
      const qrDataUrl = await QRCode.toDataURL(joinUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.95,
        margin: 2,
        color: {
          dark: '#0A0A0A',  // Asphalt black
          light: '#FFFFFF'
        },
        width: 300
      });
      
      return {
        dataUrl: qrDataUrl,
        url: joinUrl,
        sessionCode
      };
    } catch (error) {
      console.error('QR generation error:', error);
      throw error;
    }
  }

  /**
   * Generate QR code for app installation only
   */
  async generateAppInstallQR() {
    const appUrl = window.location.origin;
    
    try {
      const qrDataUrl = await QRCode.toDataURL(appUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.95,
        margin: 2,
        color: {
          dark: '#FF006E',  // Hot pink for install
          light: '#FFFFFF'
        },
        width: 300
      });
      
      return {
        dataUrl: qrDataUrl,
        url: appUrl
      };
    } catch (error) {
      console.error('QR generation error:', error);
      throw error;
    }
  }

  /**
   * Parse join code from URL
   * Checks for ?join=SESSION_CODE parameter
   */
  getJoinCodeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    
    if (joinCode) {
      // Clear the URL parameter after reading
      window.history.replaceState({}, document.title, window.location.pathname);
      return joinCode;
    }
    
    return null;
  }

  /**
   * Generate shareable text message
   */
  generateShareMessage(sessionCode) {
    const appUrl = window.location.origin;
    const joinUrl = `${appUrl}/?join=${sessionCode}`;
    
    return `🎮 Join my Mom's Coming game!\n\nGame Code: ${sessionCode}\n\nScan QR or open: ${joinUrl}\n\nInstall the app, then we play!`;
  }

  /**
   * Share via Web Share API (if available)
   */
  async shareGame(sessionCode) {
    const shareData = {
      title: "Mom's Coming - Join My Game!",
      text: this.generateShareMessage(sessionCode),
      url: `${window.location.origin}/?join=${sessionCode}`
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return true;
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareData.text);
        return 'copied';
      }
    } catch (error) {
      console.error('Share error:', error);
      return false;
    }
  }

  /**
   * Download QR code as image
   */
  downloadQR(dataUrl, filename = 'game-join-qr.png') {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export default new QRCodeService();
