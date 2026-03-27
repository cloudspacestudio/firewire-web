CREATE TABLE [dbo].[deviceSetDevices](
    [deviceSetDeviceId] [nvarchar](40) NOT NULL,
    [deviceSetId] [nvarchar](40) NOT NULL,
    [deviceId] [nvarchar](40) NOT NULL,
    [createat] [datetime] NOT NULL,
    [createby] [nvarchar](40) NOT NULL,
 CONSTRAINT [PK_deviceSetDevices] PRIMARY KEY CLUSTERED
(
    [deviceSetDeviceId] ASC
)
)
GO

ALTER TABLE [dbo].[deviceSetDevices] ADD CONSTRAINT [DF_deviceSetDevices_deviceSetDeviceId] DEFAULT (newid()) FOR [deviceSetDeviceId]
GO

ALTER TABLE [dbo].[deviceSetDevices] ADD DEFAULT (getdate()) FOR [createat]
GO

ALTER TABLE [dbo].[deviceSetDevices] ADD DEFAULT ('system') FOR [createby]
GO
