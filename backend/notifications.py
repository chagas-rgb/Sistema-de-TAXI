"""
Notification Service Abstraction
Provides a unified interface for sending notifications via multiple channels
Currently implements: SMS (Twilio), Toast events
Ready for: WhatsApp, Push notifications
"""
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import logging
import asyncio

logger = logging.getLogger(__name__)

class NotificationChannel(ABC):
    """Abstract base class for notification channels"""
    
    @abstractmethod
    async def send(self, recipient: str, message: str, data: Optional[Dict[str, Any]] = None) -> bool:
        """Send a notification through this channel"""
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Check if this channel is available/configured"""
        pass

class SMSChannel(NotificationChannel):
    """SMS notifications via Twilio (or mock)"""
    
    def __init__(self, account_sid: str = None, auth_token: str = None, from_number: str = None):
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.from_number = from_number
        self.client = None
        
        # Initialize Twilio client if credentials provided
        if account_sid and auth_token:
            try:
                from twilio.rest import Client
                self.client = Client(account_sid, auth_token)
            except ImportError:
                logger.warning("Twilio library not installed. SMS notifications will be mocked.")
    
    async def send(self, recipient: str, message: str, data: Optional[Dict[str, Any]] = None) -> bool:
        if not self.is_available():
            logger.info(f"[MOCK SMS] To: {recipient} | Message: {message}")
            return True
        
        try:
            self.client.messages.create(
                body=message,
                from_=self.from_number,
                to=recipient
            )
            logger.info(f"SMS sent to {recipient}")
            return True
        except Exception as e:
            logger.error(f"SMS send error: {e}")
            return False
    
    def is_available(self) -> bool:
        return self.client is not None and self.from_number is not None

class WhatsAppChannel(NotificationChannel):
    """WhatsApp notifications (placeholder for future implementation)"""
    
    def __init__(self):
        self._available = False
    
    async def send(self, recipient: str, message: str, data: Optional[Dict[str, Any]] = None) -> bool:
        # Placeholder for WhatsApp integration
        logger.info(f"[PLACEHOLDER WhatsApp] To: {recipient} | Message: {message}")
        return True
    
    def is_available(self) -> bool:
        return self._available

class PushChannel(NotificationChannel):
    """Push notifications (placeholder for future implementation)"""
    
    def __init__(self):
        self._available = False
    
    async def send(self, recipient: str, message: str, data: Optional[Dict[str, Any]] = None) -> bool:
        # Placeholder for push notification
        logger.info(f"[PLACEHOLDER Push] To: {recipient} | Message: {message}")
        return True
    
    def is_available(self) -> bool:
        return self._available

class InAppChannel(NotificationChannel):
    """In-app notifications via SSE events"""
    
    def __init__(self, event_queue: asyncio.Queue):
        self.event_queue = event_queue
    
    async def send(self, recipient: str, message: str, data: Optional[Dict[str, Any]] = None) -> bool:
        try:
            await self.event_queue.put({
                "type": "notification",
                "data": {
                    "recipient": recipient,
                    "message": message,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    **(data or {})
                }
            })
            return True
        except Exception as e:
            logger.error(f"In-app notification error: {e}")
            return False
    
    def is_available(self) -> bool:
        return self.event_queue is not None

class NotificationService:
    """
    Unified notification service that routes messages to appropriate channels
    """
    
    def __init__(self):
        self.channels: Dict[str, NotificationChannel] = {}
    
    def register_channel(self, name: str, channel: NotificationChannel):
        """Register a notification channel"""
        self.channels[name] = channel
        logger.info(f"Registered notification channel: {name} (available: {channel.is_available()})")
    
    async def notify(
        self, 
        recipient: str, 
        message: str, 
        channels: Optional[list] = None,
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, bool]:
        """
        Send notification through specified channels
        If no channels specified, sends through all available channels
        """
        results = {}
        
        target_channels = channels or list(self.channels.keys())
        
        for channel_name in target_channels:
            channel = self.channels.get(channel_name)
            if channel and channel.is_available():
                results[channel_name] = await channel.send(recipient, message, data)
            elif channel:
                # Channel exists but not available, try anyway (might be mocked)
                results[channel_name] = await channel.send(recipient, message, data)
        
        return results
    
    async def notify_trip_confirmed(self, trip: dict) -> Dict[str, bool]:
        """Send notifications when a trip is confirmed"""
        passengers = trip.get("passengers", [])
        main_passenger = passengers[0] if passengers else {}
        phone = main_passenger.get("phone") or trip.get("requester_phone", "")
        
        driver_name = trip.get("driver_name", "o motorista")
        driver_phone = trip.get("driver_phone", "")
        
        message = f"Seu táxi foi confirmado! {driver_name}"
        if driver_phone:
            message += f" ({driver_phone})"
        message += " está a caminho."
        
        if trip.get("is_scheduled"):
            message += f" Agendado para {trip.get('scheduled_date')} às {trip.get('scheduled_time')}."
        
        return await self.notify(phone, message, data={"trip_id": trip.get("id"), "type": "trip_confirmed"})
    
    async def notify_trip_cancelled(self, trip: dict, reason: str = "") -> Dict[str, bool]:
        """Send notifications when a trip is cancelled"""
        passengers = trip.get("passengers", [])
        main_passenger = passengers[0] if passengers else {}
        phone = main_passenger.get("phone") or trip.get("requester_phone", "")
        
        message = f"Sua solicitação de táxi foi cancelada."
        if reason:
            message += f" Motivo: {reason}"
        
        return await self.notify(phone, message, data={"trip_id": trip.get("id"), "type": "trip_cancelled"})
    
    async def notify_new_request(self, trip: dict) -> Dict[str, bool]:
        """Send notifications to admins when a new request arrives"""
        message = f"Nova solicitação de táxi de {trip.get('requester_name', 'Cliente')}"
        
        if trip.get("is_scheduled"):
            message += f" para {trip.get('scheduled_date')} às {trip.get('scheduled_time')}"
        
        # This would notify admin users - for now just logs
        return await self.notify("admin", message, ["in_app"], data={"trip_id": trip.get("id"), "type": "new_request"})

# Global notification service instance
notification_service = NotificationService()

def init_notification_service(event_queue: asyncio.Queue, twilio_config: dict = None):
    """Initialize the notification service with available channels"""
    
    # In-app notifications (always available)
    notification_service.register_channel("in_app", InAppChannel(event_queue))
    
    # SMS notifications
    if twilio_config:
        notification_service.register_channel("sms", SMSChannel(
            account_sid=twilio_config.get("account_sid"),
            auth_token=twilio_config.get("auth_token"),
            from_number=twilio_config.get("from_number")
        ))
    else:
        # Register mock SMS channel
        notification_service.register_channel("sms", SMSChannel())
    
    # WhatsApp (placeholder)
    notification_service.register_channel("whatsapp", WhatsAppChannel())
    
    # Push notifications (placeholder)
    notification_service.register_channel("push", PushChannel())
    
    return notification_service
