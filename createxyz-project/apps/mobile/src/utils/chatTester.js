import { AmiXStorage } from './storage';
import { AmiXCrypto } from './crypto';

class ChatTester {
  static async runTests() {
    console.log('Starting chat functionality tests...\n');
    
    try {
      // Initialize test data
      await this.initializeTestData();
      
      // Run tests
      await this.testMessageSending();
      await this.testMessageReactions();
      await this.testContactVerification();
      
      console.log('\n✅ All tests completed successfully!');
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }

  static async initializeTestData() {
    console.log('Setting up test data...');
    
    // Create test contact
    const testContact = {
      id: 'test-contact-1',
      name: 'Test Contact',
      publicKey: await AmiXCrypto.generateKeyPair().publicKey,
      verified: false,
      lastSeen: new Date().toISOString()
    };
    
    await AmiXStorage.saveContact(testContact);
    console.log('✓ Test contact created');
    
    // Generate identity keys if they don't exist
    let keys = await AmiXStorage.getIdentityKeys();
    if (!keys) {
      keys = await AmiXCrypto.generateKeyPair();
      await AmiXStorage.storeIdentityKeys(keys);
      console.log('✓ Identity keys generated');
    }
    
    console.log('Test data setup complete\n');
    return testContact.id;
  }

  static async testMessageSending() {
    console.log('--- Testing Message Sending ---');
    
    const testContactId = 'test-contact-1';
    const testMessage = 'Hello, this is a test message';
    
    // Create ratchet state for test contact
    const contact = await AmiXStorage.getContact(testContactId);
    const keys = await AmiXStorage.getIdentityKeys();
    
    let ratchetState = await AmiXStorage.getRatchetState(testContactId);
    if (!ratchetState) {
      ratchetState = await AmiXCrypto.createRatchetState(
        await AmiXCrypto.performKeyExchange(contact.publicKey, keys.privateKey),
        keys.privateKey,
        contact.publicKey
      );
      await AmiXStorage.storeRatchetState(testContactId, ratchetState);
    }
    
    // Create and save test message
    const encryptedData = await AmiXCrypto.encryptMessage(testMessage, ratchetState);
    
    const testMessageObj = {
      id: await AmiXCrypto.generateSecureUUID(),
      text: testMessage,
      encryptedData,
      sender: 'me',
      timestamp: new Date().toISOString(),
      status: 'sent',
      type: 'text',
      hasReactions: false
    };
    
    await AmiXStorage.storeMessage(testContactId, testMessageObj);
    
    // Verify message was saved
    const messages = await AmiXStorage.getMessages(testContactId);
    const savedMessage = messages.find(m => m.id === testMessageObj.id);
    
    if (!savedMessage) {
      throw new Error('Failed to save test message');
    }
    
    // Verify message can be decrypted
    const decrypted = await AmiXCrypto.decryptMessage(
      savedMessage.encryptedData,
      ratchetState
    );
    
    if (decrypted !== testMessage) {
      throw new Error('Message decryption failed');
    }
    
    console.log('✓ Message sending and encryption test passed');
  }

  static async testMessageReactions() {
    console.log('\n--- Testing Message Reactions ---');
    
    const testContactId = 'test-contact-1';
    const messages = await AmiXStorage.getMessages(testContactId);
    
    if (messages.length === 0) {
      throw new Error('No messages found for reaction test');
    }
    
    const testMessage = messages[0];
    const testReaction = '👍';
    
    // Add reaction
    const ratchetState = await AmiXStorage.getRatchetState(testContactId);
    const sharedKey = ratchetState.rootKey || ratchetState.chainKey;
    
    const reaction = {
      messageId: testMessage.id,
      userId: (await AmiXStorage.getIdentityKeys()).publicKey,
      emoji: testReaction,
      timestamp: new Date().toISOString()
    };
    
    const encryptedReaction = await AmiXCrypto.encryptReaction(reaction, sharedKey);
    
    // In a real app, you would send the encrypted reaction to the peer
    console.log('✓ Reaction encrypted:', encryptedReaction);
    
    // Update message with reaction
    await AmiXStorage.addReaction(
      testMessage.id, 
      reaction.userId, 
      testReaction
    );
    
    // Verify reaction was saved
    const updatedMessages = await AmiXStorage.getMessages(testContactId);
    const updatedMessage = updatedMessages.find(m => m.id === testMessage.id);
    
    if (!updatedMessage.reactions || !updatedMessage.reactions[testReaction]) {
      throw new Error('Failed to save reaction');
    }
    
    console.log('✓ Message reaction test passed');
  }

  static async testContactVerification() {
    console.log('\n--- Testing Contact Verification ---');
    
    const testContactId = 'test-contact-1';
    const contact = await AmiXStorage.getContact(testContactId);
    const keys = await AmiXStorage.getIdentityKeys();
    
    // Generate safety number
    const safetyNumber = await AmiXCrypto.generateSafetyNumber(
      keys.publicKey,
      contact.publicKey
    );
    
    console.log('Generated safety number:', safetyNumber);
    
    // Mark contact as verified
    await AmiXStorage.updateContact(testContactId, { verified: true });
    
    // Verify contact was updated
    const updatedContact = await AmiXStorage.getContact(testContactId);
    
    if (!updatedContact.verified) {
      throw new Error('Failed to verify contact');
    }
    
    console.log('✓ Contact verification test passed');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  ChatTester.runTests().catch(console.error);
}

export default ChatTester;
