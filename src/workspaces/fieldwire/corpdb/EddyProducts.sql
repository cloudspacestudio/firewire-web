USE [corp]
GO

/****** Object:  Table [dbo].[EddyProducts]    Script Date: 4/2/2025 11:55:32 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[EddyProducts](
	[RecordID] [nvarchar](50) NOT NULL,
	[ProductID] [int] NOT NULL,
	[PartNumber] [nvarchar](50) NOT NULL,
	[LongDescription] [nvarchar](1000) NOT NULL,
	[PrimaryImage] [nvarchar](1000) NULL,
	[TradePrice] [money] NOT NULL,
	[SalesPrice] [money] NOT NULL,
	[ClearancePrice] [money] NOT NULL,
	[FutureTradePrice] [money] NOT NULL,
	[FutureMSRPEffectiveDate] [date] NULL,
	[FutureSalesPrice] [money] NOT NULL,
	[FutureSalesEffectiveDate] [date] NULL,
	[QuantityAvailable] [int] NOT NULL,
	[ProductOrderable] [bit] NOT NULL,
	[ReplacedBy] [nvarchar](50) NULL,
	[IsDiscontinued] [bit] NOT NULL,
	[IsTrainingProduct] [bit] NOT NULL,
	[NonPurchasableMessage] [nvarchar](100) NULL,
	[TieredPricingAvailable] [bit] NOT NULL,
	[RootCategoryID] [int] NOT NULL,
	[RootCategoryName] [nvarchar](50) NOT NULL,
	[ProductCategoryID] [int] NOT NULL,
	[ProductCategoryName] [nvarchar](50) NOT NULL,
	[AsOf] [datetime] NOT NULL
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_Table_1_RecordId]  DEFAULT (newid()) FOR [RecordID]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_EddyProducts_TradePrice]  DEFAULT ((0.00)) FOR [TradePrice]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_EddyProducts_SalesPrice]  DEFAULT ((0.00)) FOR [SalesPrice]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_EddyProducts_ClearancePrice]  DEFAULT ((0.00)) FOR [ClearancePrice]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_EddyProducts_FutureTradePrice]  DEFAULT ((0.00)) FOR [FutureTradePrice]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_EddyProducts_FutureSalesPrice]  DEFAULT ((0.00)) FOR [FutureSalesPrice]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_EddyProducts_QuantityAvailable]  DEFAULT ((0)) FOR [QuantityAvailable]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_EddyProducts_ProductOrderable]  DEFAULT ((1)) FOR [ProductOrderable]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_EddyProducts_IsDiscontinued]  DEFAULT ((0)) FOR [IsDiscontinued]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_EddyProducts_IsTrainingProduct]  DEFAULT ((0)) FOR [IsTrainingProduct]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_EddyProducts_TieredPricingAvailable]  DEFAULT ((0)) FOR [TieredPricingAvailable]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_Table_1_ts]  DEFAULT (getdate()) FOR [AsOf]
GO

